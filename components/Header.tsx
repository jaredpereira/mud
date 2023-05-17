import { db, useMutations } from "hooks/useReplicache";
import { useUIState } from "hooks/useUIState";
import { scanIndex } from "src/replicache";
import { ulid } from "src/ulid";
import { sortByPosition } from "src/utils";
import { Plus } from "./Icons";
export const Header = () => {
  let focusMode = useUIState((s) => s.focusMode);
  let home = db.useAttribute("home")[0];
  let root = useUIState((s) => s.root);
  let focused = useUIState((s) => s.focused);
  let { mutate, rep } = useMutations();
  return (
    <>
      <div className="h-6" />
      <div className="fixed z-10 h-6 w-full p-2" style={{ top: 0, left: 0 }}>
        <div className="m-auto max-w-3xl  pl-2 pr-6">
          <div className="flex flex-row justify-between gap-2 border-b bg-background">
            <button
              className={`justify-self-end text-sm ${
                focusMode ? "underline" : ""
              }`}
              onClick={() => {
                useUIState.setState((s) => ({ focusMode: !s.focusMode }));
              }}
            >
              focus
            </button>
            <button
              onClick={async () => {
                if (!rep) return;
                let parent = root || home.entity;
                let siblings = await rep.query((tx) =>
                  scanIndex(tx).vae(parent, "block/parent")
                );
                let child = ulid();
                await mutate("addChildBlock", {
                  factID: ulid(),
                  parent: root || home.entity,
                  child,
                  before: siblings?.sort(sortByPosition)[0]?.entity || "",
                });
                useUIState.setState({ focused: child });
              }}
            >
              <Plus />
            </button>
            {focused && (
              <button onClick={() => useUIState.setState({ root: focused })}>
                zooom
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
