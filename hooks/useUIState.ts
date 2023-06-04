import Router from "next/router";
import { ReadTransaction } from "replicache";
import { scanIndex } from "src/replicache";
import { sortByPosition } from "src/utils";
import { create } from "zustand";
import { combine, persist, createJSONStorage } from "zustand/middleware";

export let useUIState = create(
  persist(
    combine(
      {
        yankedBlock: undefined as string | undefined,
        root: undefined as string | undefined,
        openStates: {} as Record<string, boolean>,
        focusedBlockTextarea: null,
        mode: "normal",
        focusMode: false,
        focused: undefined as string | undefined,
      },
      (set) => ({
        setRoot: (id: string | undefined) => {
          let query = { ...Router.query, root: id };
          Router.push({ query }, undefined, {
            shallow: true,
          });
        },
        setFocused: (id: string | undefined) => set({ focused: id }),

        setOpen: (entity: string, open: boolean) =>
          set((s) => ({
            openStates: { ...s.openStates, [entity]: open },
          })),
      })
    ),
    {
      name: "uninitialized",
      skipHydration: true,
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);

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
