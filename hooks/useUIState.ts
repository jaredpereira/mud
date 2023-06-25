import Router from "next/router";
import { ReadTransaction, Replicache } from "replicache";
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

export async function openBlock(block: string, rep: Replicache) {
  let path = await rep.query(async (tx) => {
    let path = [];
    let current = block;
    while (current) {
      let parent = await scanIndex(tx).eav(current, "block/parent");
      if (!parent) break;
      path.push(parent.value.value);
      current = parent.value.value;
    }
    return path;
  });
  let state = useUIState.getState();
  if (state.root && !path.includes(state.root)) {
    state.setRoot(undefined);
  }
  useUIState.setState((s) => ({
    s,
    openStates: {
      ...s.openStates,
      ...Object.fromEntries(path.map((p) => [p, true])),
    },
  }));
  state.setFocused(block);
  document.getElementById(block)?.scrollIntoView();
}
