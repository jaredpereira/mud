import { useMutations } from "hooks/useReplicache";
import useWindowDimensions, { useViewportSize } from "hooks/window";
import { useContext } from "react";
import { getPreviousSibling, useOpenStates } from "src/openStates";
import { ulid } from "src/ulid";
import { ReplicacheContext } from "./ReplicacheProvider";
import { useUIState } from "hooks/useUIState";

export function Toolbar() {
  let { width } = useWindowDimensions();
  if (width > 640) return null;
  return (
    <>
      <div className="h-6" />
      <ToolbarBase />
    </>
  );
}

function ToolbarBase() {
  let { height } = useViewportSize();
  let focused = useUIState((s) => s.focused);
  let focusMode = useUIState((s) => s.focusMode);
  let { mutate, action } = useMutations();
  let rep = useContext(ReplicacheContext)?.rep;

  return (
    <div
      className="fixed flex h-6 w-full flex-row gap-2 border-t border-b bg-background px-8"
      style={{ top: height - 24, left: 0 }}
    >
      <button
        onClick={async () => {
          if (!focused || !rep) return;
          let entityID = focused;
          let previousSibling = await rep.query((tx) =>
            getPreviousSibling(tx, entityID)
          );
          if (previousSibling) {
            let sib = previousSibling;
            useOpenStates.setState((s) => ({
              openStates: {
                ...s.openStates,
                [sib]: true,
              },
            }));
          }

          mutate("indentBlock", {
            entityID: focused,
            factID: ulid(),
          });
        }}
      >
        indent
      </button>

      <button
        onClick={() => {
          if (!focused) return;
          mutate("outdentBlock", {
            entityID: focused,
            factID: ulid(),
          });
        }}
      >
        outdent
      </button>

      <button
        onClick={() => {
          if (!focused) return;
          mutate("moveBlockUp", {
            entityID: focused,
          });
        }}
      >
        up
      </button>

      <button
        onClick={() => {
          if (!focused) return;
          mutate("moveBlockDown", {
            entityID: focused,
          });
        }}
      >
        down
      </button>
      <button
        onClick={() => {
          action.undo();
        }}
      >
        undo
      </button>

      <button
        onClick={() => {
          action.redo();
        }}
      >
        redo
      </button>

      <button
        onClick={() => {
          useUIState.setState((s) => ({ focusMode: !s.focusMode }));
        }}
      >
        {focusMode ? "focus" : "unfocus"}
      </button>
    </div>
  );
}
