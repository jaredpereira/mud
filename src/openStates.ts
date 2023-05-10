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
