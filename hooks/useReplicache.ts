import {
  Attribute,
  ReferenceAttributes,
  UniqueAttributes,
} from "data/Attributes";
import { Fact } from "data/Facts";
import { Message } from "data/Messages";
import { CardinalityResult, Mutations } from "data/mutations";
import { useCallback, useContext, useMemo } from "react";
import { useSubscribe } from "hooks/useSubscribe";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { scanIndex } from "src/replicache";

export const db = {
  useEntity<A extends keyof Attribute>(
    entity: string | null,
    attribute: A
  ): CardinalityResult<A> | null {
    return useSubscribe(
      async (tx) => {
        if (!entity) return null;
        let result = await scanIndex(tx).eav(entity, attribute);
        return (result as CardinalityResult<A>) || null;
      },
      null,
      [attribute, entity],
      "eav" + entity + attribute
    );
  },
  useUniqueAttribute<A extends keyof UniqueAttributes>(
    attribute: A,
    value: string | undefined
  ) {
    return useSubscribe(
      async (tx) => {
        if (!value) return null;
        return (await scanIndex(tx).ave(attribute, value)) || null;
      },
      null,
      [attribute, value],
      "ave" + attribute + value
    );
  },
  useAttribute<A extends keyof Attribute>(
    attribute: A | null,
    entity?: string
  ) {
    return useSubscribe(
      async (tx) => {
        if (!attribute) return [];
        let results = await tx
          .scan({
            indexName: "aev",
            prefix: `${attribute}-${entity || ""}`,
          })
          .values()
          .toArray();
        return results as Fact<A>[];
      },
      [],
      [attribute, entity],
      "aev" + attribute + entity
    );
  },
  useReference<A extends keyof ReferenceAttributes>(
    entity: string,
    attribute?: A
  ) {
    return useSubscribe(
      async (tx) => {
        let results = await tx
          .scan({
            indexName: "vae",
            prefix: `${entity}-${attribute || ""}`,
          })
          .values()
          .toArray();
        return results as Fact<A>[];
      },
      [],
      [entity, attribute],
      "vae" + entity + attribute
    );
  },
  useMessages(topic: string) {
    return useSubscribe(
      async (tx) => {
        let messages = await tx
          .scan({ indexName: "messages", prefix: topic })
          .values()
          .toArray();
        return messages as Message[];
      },
      [],
      [topic],
      topic
    );
  },
  useMessagesById(id: string | null) {
    return useSubscribe(
      async (tx) => {
        if (!id) return null;
        let message = await tx.get(id);
        return message as Message | null;
      },
      null,
      [id],
      "messages" + id
    );
  },
};

export const useSpaceID = () => {
  return useContext(ReplicacheContext)?.id;
};

export const useMutations = () => {
  let rep = useContext(ReplicacheContext);
  let mutate = useCallback(
    function mutate<T extends keyof typeof Mutations>(
      mutation: T,
      args: Parameters<(typeof Mutations)[T]>[0]
    ) {
      return rep?.rep.mutate[mutation](args);
    },
    [rep?.rep]
  );
  let action = useMemo(
    () => ({
      start() {
        rep?.undoManager.startGroup();
      },
      end() {
        rep?.undoManager.endGroup();
      },
      add(opts: {
        undo: () => Promise<void> | void;
        redo: () => Promise<void> | void;
      }) {
        rep?.undoManager.add(opts);
      },
      undo: () => rep?.undoManager.undo(),
      redo: () => rep?.undoManager.redo(),
    }),
    [rep?.undoManager]
  );

  // if (rep == null) throw "Cannot call useMutations() if not nested within a ReplicacheContext context"

  return {
    rep: rep?.rep,
    mutate,
    action,
  };
};
