import { ReadTransaction } from "replicache";
import { scanIndex } from "./replicache";
import { sortByPosition } from "./utils";
import { create } from "zustand";

export const useOpenStates = create<{
  openStates: { [key: string]: boolean };
  setOpen: (entity: string, open: boolean) => void;
}>((set, get) => ({
  openStates: {} as { [key: string]: boolean },
  setOpen: (entity: string, open: boolean) =>
    set({
      openStates: { ...get().openStates, [entity]: open },
    }),
}));

export async function getLastOpenChild(
  tx: ReadTransaction,
  parent: string
): Promise<string> {
  if (!useOpenStates.getState().openStates[parent]) return parent;
  let children = (await scanIndex(tx).vae(parent, "block/parent")).sort(
    sortByPosition
  );
  if (children.length === 0) return parent;
  return getLastOpenChild(tx, children[children.length - 1].entity);
}

export async function getPreviousSibling(
  tx: ReadTransaction,
  entityID: string
) {
  let parent = await scanIndex(tx).eav(entityID, "block/parent");
  if (!parent) return;

  let siblings = (
    await scanIndex(tx).vae(parent.value.value, "block/parent")
  ).sort(sortByPosition);
  let position = siblings.findIndex((s) => s.entity === entityID);
  if (position < 1) return;
  return siblings[position - 1].entity;
}
