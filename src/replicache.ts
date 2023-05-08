import { UndoManager } from "@rocicorp/undo";
import {
  CardinalityResult,
  FactInput,
  MutationContext,
  Mutations,
} from "data/mutations";
import { ReadTransaction, Replicache, WriteTransaction } from "replicache";

import { Message } from "data/Messages";
import { Fact, ReferenceType } from "data/Facts";
import { Attribute } from "data/Attributes";
import { ulid } from "./ulid";

export type ReplicacheMutators = {
  [k in keyof typeof Mutations]: (
    tx: WriteTransaction,
    args: Parameters<(typeof Mutations)[k]>[0]
  ) => Promise<void>;
};

export const scanIndex = (tx: ReadTransaction) => {
  const q: MutationContext["scanIndex"] = {
    aev: async (attribute, entity) => {
      if (!attribute) return [];
      let results = await tx
        .scan({
          indexName: "aev",
          prefix: `${attribute}-${entity || ""}`,
        })
        .values()
        .toArray();
      return results as Fact<typeof attribute>[];
    },
    eav: async (entity, attribute) => {
      let results = await tx
        .scan({
          indexName: "eav",
          prefix: `${entity}-${attribute ? `${attribute}-` : ""}`,
        })
        .values()
        .toArray();

      if (!attribute) return results as CardinalityResult<typeof attribute>;
      let schema = await getSchema(attribute);
      if (schema?.cardinality === "one")
        return results[0] as CardinalityResult<typeof attribute>;
      return results as CardinalityResult<typeof attribute>;
    },
    vae: async (entity, attribute) => {
      let results = await tx
        .scan({
          indexName: "vae",
          prefix: `${entity}-${attribute || ""}`,
        })
        .values()
        .toArray();
      return results as Fact<Exclude<typeof attribute, undefined>>[];
    },
    ave: async (attribute, value) => {
      let results = await tx
        .scan({
          indexName: "ave",
          prefix: `${attribute}-${value}`,
        })
        .values()
        .toArray();
      return results[0] as Fact<typeof attribute>;
    },
  };
  return q;
};

export function makeMutators(
  dataFunc: () => {
    rep: Replicache<ReplicacheMutators>;
    undoManager: UndoManager;
  }
): ReplicacheMutators {
  let mutators: ReplicacheMutators = Object.keys(Mutations).reduce((acc, k) => {
    acc[k as keyof typeof Mutations] = async (
      tx: WriteTransaction,
      mutationArgs: any
    ) => {
      let q = scanIndex(tx);
      let context: MutationContext = {
        runOnServer: async () => {},
        scanIndex: q,
        postMessage: async (m) => {
          await tx.put(m.id, MessageWithIndexes(m));
          return { success: true };
        },
        retractFact: async (id, undoAction) => {
          let { rep, undoManager } = dataFunc();

          let existingFact = (await tx.get(id)) as
            | Fact<keyof Attribute>
            | undefined;

          await tx.del(id);

          if (!undoAction) {
            undoManager.add({
              undo: async () => {
                if (!existingFact) return;
                await rep.mutate.assertFact({
                  ...existingFact,
                  factID: id,
                  undoAction: true,
                } as FactInput);
              },
              redo: async () => {
                await rep.mutate.retractFact({ id, undoAction: true });
              },
            });
          }

          return;
        },
        updateFact: async (id, data, undoAction) => {
          let { rep, undoManager } = dataFunc();

          let existingFact = (await tx.get(id)) as Fact<any> | undefined;

          if (!existingFact) return { success: false };
          let newData = FactWithIndexes({
            ...existingFact,
            ...data,
            id,
            schema: existingFact.schema,
            lastUpdated: Date.now().toString(),
          });
          await tx.put(id, newData);

          if (!undoAction) {
            undoManager.add({
              undo: async () => {
                if (!existingFact) return;
                await rep.mutate.updateFact({
                  id,
                  data: existingFact,
                  undoAction: true,
                });
              },
              redo: async () => {
                await rep.mutate.updateFact({ id, data, undoAction: true });
              },
            });
          }

          return { success: true };
        },
        assertFact: async (fact, undoAction) => {
          let { rep, undoManager } = dataFunc();

          let schema = await getSchema(fact.attribute);
          if (!schema) return { success: false, error: "no schema" };
          let lastUpdated = Date.now().toString();
          let newID: string = "";
          let existingFact: Fact<keyof Attribute> | undefined;
          if (schema.cardinality === "one") {
            existingFact = (await q.eav(fact.entity, fact.attribute)) as
              | Fact<keyof Attribute>
              | undefined;
            if (existingFact) {
              newID = existingFact.id;
            }
          }
          if (!newID) newID = fact.factID || ulid();
          let data = FactWithIndexes({
            id: newID,
            ...fact,
            lastUpdated,
            schema,
          });
          await tx.put(newID, data);

          if (!undoAction) {
            undoManager.add({
              undo: async () => {
                if (existingFact) {
                  let value = existingFact.value;

                  await rep.mutate.assertFact({
                    entity: fact.entity,
                    attribute: fact.attribute,
                    value: value,
                    undoAction: true,
                  } as FactInput);
                } else {
                  await rep.mutate.retractFact({ id: newID, undoAction: true });
                }
              },
              redo: async () => {
                await rep.mutate.assertFact({
                  ...fact,
                  undoAction: true,
                } as FactInput);
              },
            });
          }

          return { success: true, factID: newID };
        },
      };
      return Mutations[k as keyof typeof Mutations](mutationArgs, context);
    };
    return acc;
  }, {} as ReplicacheMutators);

  return mutators;
}

const getSchema = async (attributeName: string) => {
  return Attribute[attributeName as keyof Attribute];
};
export function MessageWithIndexes(m: Message) {
  return {
    ...m,
    indexes: {
      messages: `${m.topic || "general"}-${m.ts}-${m.id}`,
    },
  };
}

export function FactWithIndexes<A extends keyof Attribute>(f: Fact<A>) {
  let indexes: {
    eav: string;
    aev: string;
    at?: string;
    ave?: string;
    vae?: string;
  } = {
    eav: `${f.entity}-${f.attribute}-${f.id}`,
    aev: `${f.attribute}-${f.entity}-${f.id}`,
  };
  if (f.schema.unique) indexes.ave = `${f.attribute}-${f.value}`;
  if (f.schema.type === "reference" || f.schema.type === "parent")
    indexes.vae = `${(f.value as ReferenceType).value}-${f.attribute}`;
  return { ...f, indexes };
}
