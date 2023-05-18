import { Env } from "backend/SpaceDurableObject";
import { generateKeyBetween } from "src/fractional-indexing";
import { sortByPosition } from "src/utils";
import { Attribute, ReferenceAttributes } from "./Attributes";
import { Fact, ref } from "./Facts";
import { Message } from "./Messages";

export type MutationContext = {
  postMessage: (message: Message) => Promise<{ success: boolean }>;
  assertFact: <A extends keyof Attribute>(
    d: Pick<Fact<A>, "entity" | "attribute" | "value"> & {
      factID?: string;
    },
    undoAction?: boolean
  ) => Promise<{ success: false } | { success: true; factID: string }>;
  updateFact: (
    id: string,
    data: Partial<Fact<any>>,
    undoAction?: boolean
  ) => Promise<{ success: boolean }>;
  runOnServer: (fn: (env: Env) => Promise<void>) => Promise<void>;
  retractFact: (id: string, undoAction?: boolean) => Promise<void>;
  scanIndex: {
    vae: <A extends keyof ReferenceAttributes>(
      entity: string,
      attribute?: A
    ) => Promise<Fact<A>[]>;
    eav: <A extends keyof Attribute | null>(
      entity: string,
      attribute: A
    ) => Promise<CardinalityResult<A>>;
    aev: <A extends keyof Attribute>(
      attribute: A,
      entity?: string
    ) => Promise<Fact<A>[]>;
    ave: <A extends keyof UniqueFacts>(
      attribute: A,
      value: string
    ) => Promise<Fact<A> | undefined>;
  };
};

type UniqueFacts = {
  [A in keyof Attribute as Attribute[A]["unique"] extends true
    ? A
    : never]: Attribute[A];
};

type OptionalAttribute<A extends keyof Attribute | null> =
  A extends keyof Attribute ? A : keyof Attribute;
export type CardinalityResult<A extends keyof Attribute | null> = null extends A
  ? Fact<keyof Attribute>[]
  : Attribute[OptionalAttribute<A>] extends {
      cardinality: "one";
    }
  ? Fact<OptionalAttribute<A>> | null
  : Fact<OptionalAttribute<A>>[];

type Mutation<T> = (args: T, ctx: MutationContext) => Promise<void>;

export type FactInput = {
  [A in keyof Attribute]: Pick<Fact<A>, "attribute" | "entity" | "value"> & {
    factID?: string;
  };
}[keyof Attribute];
const assertFact: Mutation<
  (FactInput | FactInput[]) & { undoAction?: boolean }
> = async (args, ctx) => {
  await Promise.all(
    [args].flat().map((f) => {
      return ctx.assertFact({ ...f }, args.undoAction);
    })
  );
};

const retractFact: Mutation<{ id: string; undoAction?: boolean }> = async (
  args,
  ctx
) => {
  await ctx.retractFact(args.id, args.undoAction);
};

const updateFact: Mutation<{
  id: string;
  undoAction?: boolean;
  data: Partial<Fact<any>>;
}> = async (args, ctx) => {
  await ctx.updateFact(args.id, args.data, args.undoAction);
};

const deleteBlock: Mutation<{ entity: string }> = async (args, ctx) => {
  const deleteBlock = async (entityID: string) => {
    let references = await ctx.scanIndex.vae(entityID);
    let facts = await ctx.scanIndex.eav(entityID, null);
    await Promise.all(
      facts.concat(references).map((f) => ctx.retractFact(f.id))
    );
    await Promise.all(references.map((r) => deleteBlock(r.entity)));
  };
  await deleteBlock(args.entity);
};

const addChildBlock: Mutation<{
  parent: string;
  factID: string;
  child: string;
  before?: string;
  after?: string;
}> = async (args, ctx) => {
  let children = (await ctx.scanIndex.vae(args.parent, "block/parent")).sort(
    sortByPosition
  );
  let index;
  if (args.before)
    index = children.findIndex((c) => c.entity === args.before) - 1;
  else index = children.findIndex((c) => c.entity === args.after);
  let newPosition = generateKeyBetween(
    children[index]?.value.position || null,
    children[index + 1]?.value.position || null
  );
  await ctx.assertFact({
    factID: args.factID,
    entity: args.child,
    attribute: "block/parent",
    value: { type: "parent", position: newPosition, value: args.parent },
  });
};

const indentBlock: Mutation<{ entityID: string; factID: string }> = async (
  args,
  ctx
) => {
  let parent = await ctx.scanIndex.eav(args.entityID, "block/parent");
  if (!parent) return;

  let siblings = (
    await ctx.scanIndex.vae(parent.value.value, "block/parent")
  ).sort(sortByPosition);
  let position = siblings.findIndex((s) => s.entity === args.entityID);
  if (position < 1) return;
  let newParent = siblings[position - 1].entity;
  let newSiblings = (await ctx.scanIndex.vae(newParent, "block/parent")).sort(
    sortByPosition
  );
  await ctx.updateFact(parent.id, {
    value: {
      position: generateKeyBetween(
        newSiblings[newSiblings.length - 1]?.value.position || null,
        null
      ),
      value: newParent,
      type: "parent",
    },
  });
};

const moveBlockDown: Mutation<{ entityID: string }> = async (args, ctx) => {
  let parent = await ctx.scanIndex.eav(args.entityID, "block/parent");
  if (!parent) return;

  let siblings = (
    await ctx.scanIndex.vae(parent.value.value, "block/parent")
  ).sort(sortByPosition);

  let position = siblings.findIndex((s) => s.entity === args.entityID);
  if (position === siblings.length - 1) return;

  await ctx.updateFact(parent.id, {
    value: {
      position: generateKeyBetween(
        siblings[position + 1]?.value.position || null,
        siblings[position + 2]?.value.position || null
      ),
      value: parent.value.value,
      type: "parent",
    },
  });
};

const moveBlockUp: Mutation<{ entityID: string }> = async (args, ctx) => {
  let parent = await ctx.scanIndex.eav(args.entityID, "block/parent");
  if (!parent) return;

  let siblings = (
    await ctx.scanIndex.vae(parent.value.value, "block/parent")
  ).sort(sortByPosition);

  let position = siblings.findIndex((s) => s.entity === args.entityID);
  if (position === 0) return;

  await ctx.updateFact(parent.id, {
    value: {
      position: generateKeyBetween(
        siblings[position - 2]?.value.position || null,
        siblings[position - 1]?.value.position || null
      ),
      value: parent.value.value,
      type: "parent",
    },
  });
};

const outdentBlock: Mutation<{ entityID: string; factID: string }> = async (
  args,
  ctx
) => {
  let parent = await ctx.scanIndex.eav(args.entityID, "block/parent");
  if (!parent) return;
  let grandParent = await ctx.scanIndex.eav(parent.value.value, "block/parent");
  if (!grandParent) return;

  let grandSiblings = (
    await ctx.scanIndex.vae(grandParent.value.value, "block/parent")
  ).sort(sortByPosition);

  let siblings = (
    await ctx.scanIndex.vae(parent.value.value, "block/parent")
  ).sort(sortByPosition);

  let parentPosition = grandSiblings.findIndex(
    (s) => s.entity === parent?.value.value
  );
  if (parentPosition < 0) return;
  let position = siblings.findIndex((s) => s.entity === args.entityID);
  if (position < 0) return;
  for (let sibling of siblings.slice(position)) {
    await ctx.updateFact(sibling.id, {
      value: {
        position: sibling.value.position,
        value: args.entityID,
        type: "parent",
      },
    });
  }

  await ctx.updateFact(parent.id, {
    value: {
      position: generateKeyBetween(
        grandSiblings[parentPosition]?.value.position || null,
        grandSiblings[parentPosition + 1]?.value.position || null
      ),
      value: grandParent.value.value,
      type: "parent",
    },
  });
};

const updateBlockContent: Mutation<{ block: string; content: string }> = async (
  args,
  ctx
) => {
  if (args.content.startsWith("#")) {
    let title = args.content.split("\n")[0].slice(1).replace(/^#+/, "").trim();
    let existingTitle = await ctx.scanIndex.eav(
      args.block,
      "block/unique-name"
    );

    if (existingTitle && existingTitle.value !== title) {
      let existingLinks = await ctx.scanIndex.vae(
        args.block,
        "block/inline-link-to"
      );
      console.log(existingLinks);
      for (let link of existingLinks) {
        console.log(link);
        let content = await ctx.scanIndex.eav(link.entity, "block/content");
        if (!content) continue;
        await ctx.assertFact({
          entity: link.entity,
          attribute: "block/content",
          value: content.value.replace(
            `[[${existingTitle.value}]]`,
            `[[${title}]]`
          ),
        });
      }
    }
    if (!existingTitle || existingTitle.value !== title) {
      await ctx.assertFact({
        entity: args.block,
        attribute: "block/unique-name",
        value: title,
      });
    }
  }

  let existingLinks = await Promise.all(
    (
      await ctx.scanIndex.eav(args.block, "block/inline-link-to")
    ).map(async (l) => ({
      id: l.id,
      title: await ctx.scanIndex.eav(l.value.value, "block/unique-name"),
    }))
  );
  console.log(existingLinks);
  let newLinks = [...args.content.matchAll(/\[\[([^\[\n\]]*)\]\]/g)];

  let linkstoremove = existingLinks.filter(
    (l) => !newLinks.find((n) => n[1] === l.title?.value)
  );

  let linkstoadd = newLinks.filter(
    (n) => !existingLinks.find((l) => n[1] === l.title?.value)
  );

  for (let link of linkstoremove) {
    await ctx.retractFact(link.id);
  }
  for (let link of linkstoadd) {
    let title = link[1];
    let entity = await ctx.scanIndex.ave("block/unique-name", title);
    if (!entity || entity.value !== title) continue;
    await ctx.assertFact({
      entity: args.block,
      attribute: "block/inline-link-to",
      value: ref(entity.entity),
    });
  }
  await ctx.assertFact({
    entity: args.block,
    attribute: "block/content",
    value: args.content,
  });
};

export const Mutations = {
  assertFact,
  retractFact,
  updateFact,
  deleteBlock,
  addChildBlock,
  indentBlock,
  outdentBlock,
  updateBlockContent,
  moveBlockDown,
  moveBlockUp,
};
