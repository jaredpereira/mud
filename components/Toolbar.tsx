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
        onPointerDown={(e) => {
          if (!focused) return;
          e.preventDefault();
          mutate("outdentBlock", {
            entityID: focused,
            factID: ulid(),
          });
        }}
      >
        <LeftArrow />
      </button>
      <button
        onPointerDown={async (e) => {
          if (!focused || !rep) return;
          e.preventDefault();
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
        onPointerDown={(e) => {
          if (!focused) return;
          e.preventDefault();
          mutate("moveBlockUp", {
            entityID: focused,
          });
        }}
      >
        <UpArrow />
      </button>

      <button
        onPointerDown={(e) => {
          e.preventDefault();
          if (!focused) return;
          mutate("moveBlockDown", {
            entityID: focused,
          });
        }}
      >
        <DownArrow />
      </button>
      <button
        onPointerDown={(e) => {
          e.preventDefault();
          action.undo();
        }}
      >
        <CounterClockwiseArrow />
      </button>

      <button
        onPointerDown={(e) => {
          e.preventDefault();
          action.redo();
        }}
      >
        <ClockwiseArrow />
      </button>
    </div>
  );
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
