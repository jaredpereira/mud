import { useMutations } from "hooks/useReplicache";
import useWindowDimensions, { useViewportSize } from "hooks/window";
import { useContext } from "react";
import { ulid } from "src/ulid";
import { ReplicacheContext } from "./ReplicacheProvider";
import { useUIState } from "hooks/useUIState";
import {
  ClockwiseArrow,
  CounterClockwiseArrow,
  DownArrow,
  LeftArrow,
  RightArrow,
  UpArrow,
} from "./Icons";
import { ReadTransaction } from "replicache";
import { scanIndex } from "src/replicache";
import { sortByPosition } from "src/utils";

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
  let { mutate, action } = useMutations();
  let rep = useContext(ReplicacheContext)?.rep;

  return (
    <div
      className="fixed flex h-6 w-full flex-row justify-between gap-4 border-t border-b bg-background px-8"
      style={{ top: height - 24, left: 0 }}
    >
      <button
        onClick={() => {
          if (!focused) return;
          mutate("outdentBlock", {
            entityID: focused,
            factID: ulid(),
          });
        }}
      >
        <LeftArrow />
      </button>
      <button
        onClick={async () => {
          if (!focused || !rep) return;
          let entityID = focused;
          let previousSibling = await rep.query((tx) =>
            getPreviousSibling(tx, entityID)
          );
          if (previousSibling) {
            let sib = previousSibling;
            useUIState.setState((s) => ({
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
        <RightArrow />
      </button>

      <button
        onClick={() => {
          if (!focused) return;
          let entityID = focused;
          withPreserveFocus(focused, async () =>
            mutate("moveBlockUp", {
              entityID,
            })
          );
        }}
      >
        <UpArrow />
      </button>

      <button
        onClick={() => {
          if (!focused) return;

          if (!focused) return;
          let entityID = focused;
          withPreserveFocus(focused, async () =>
            mutate("moveBlockDown", {
              entityID,
            })
          );
        }}
      >
        <DownArrow />
      </button>
      <button
        onClick={() => {
          action.undo();
        }}
      >
        <CounterClockwiseArrow />
      </button>

      <button
        onClick={() => {
          action.redo();
        }}
      >
        <ClockwiseArrow />
      </button>
    </div>
  );
}

const withPreserveFocus = async (entityID: string, fn: () => Promise<void>) => {
  let el = document.getElementById(entityID) as HTMLTextAreaElement | undefined;
  let start = el?.selectionStart;
  let end = el?.selectionEnd;
  await fn();
  el = document.getElementById(entityID) as HTMLTextAreaElement | undefined;
  el?.focus();
  if (start && end) el?.setSelectionRange(start, end);
};

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
