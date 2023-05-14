import { ReadTransaction } from "replicache";
import { scanIndex } from "src/replicache";
import { sortByPosition } from "src/utils";
import { create } from "zustand";
export let useUIState = create<{
  mode: "edit" | "normal";
  focused: undefined | string;
  focusMode: boolean;
  openStates: { [key: string]: boolean };
  setOpen: (entity: string, open: boolean) => void;
  setFocused: (entity: string | undefined) => void;
}>((set) => ({
  openStates: {},
  mode: "normal",
  focusMode: false,
  focused: undefined,
  setFocused: (id: string | undefined) => set({ focused: id }),

  setOpen: (entity: string, open: boolean) =>
    set((s) => ({
      openStates: { ...s.openStates, [entity]: open },
    })),
}));

export async function getLastOpenChild(
  tx: ReadTransaction,
  parent: string
): Promise<string> {
  if (!useUIState.getState().openStates[parent]) return parent;
  let children = (await scanIndex(tx).vae(parent, "block/parent")).sort(
    sortByPosition
  );
  if (children.length === 0) return parent;
  return getLastOpenChild(tx, children[children.length - 1].entity);
}
