import { Autocomplete, useAutocompleteState } from "components/Autocomplete";
import { Textarea } from "components/Textarea";
import { useKeyboardHandling } from "hooks/useKeyboardHandling";
import { db, useMutations } from "hooks/useReplicache";
import { openBlock, useUIState } from "hooks/useUIState";
import { SyntheticEvent, useCallback, useRef, useState } from "react";
import { getCoordinatesInTextarea } from "src/getCoordinatesInTextarea";
import { scanIndex } from "src/replicache";
import { getLinkAtCursor, sortByPosition } from "src/utils";
import { Caret } from "./Icons";

export type BlockProps = {
  isRoot?: boolean;
  parentFocused: boolean;
  factID: string;
  entityID: string;
  parent: string;
  before?: string;
  depth: number;
  after?: string;
};

export function Block(props: BlockProps) {
  let children = db
    .useReference(props.entityID, "block/parent")
    ?.sort(sortByPosition);

  let inFocusMode = useUIState((s) => s.focusMode);
  let focused = useUIState((s) => s.focused === props.entityID);
  let yanked = useUIState((s) => s.yankedBlock === props.entityID);
  let childFocused = useUIState(
    (s) => s.focused && children.find((child) => child.entity === s.focused)
  );
  let blurred =
    inFocusMode && !focused && !props.parentFocused && !childFocused;

  return (
    <div className={`w-full ${focused ? "" : "border border-transparent"}`}>
      <div
        style={{
          borderColor: yanked ? "blue" : blurred ? "#00000040" : "#000000FF",
          backgroundColor:
            (props.depth % 2 === 1 ? "#FFE4B5" : "#FFF8DC") +
            (blurred ? "40" : "FF"),
        }}
        className={`w-full rounded-md py-2 pl-1 pr-1 ${focused ? "border-2" : "border"
          }`}
      >
        <div className="flex flex-row gap-1 pl-0.5">
          <ToggleOpen entityID={props.entityID} count={children.length} />
          <BlockContent
            {...props}
            firstChild={children[0]?.entity}
            blurred={blurred}
          />
        </div>
        <BlockBacklinks entityID={props.entityID} />
        <BlockChildren
          parentFocused={props.parentFocused || focused}
          entityID={props.entityID}
          after={props.after}
          depth={props.depth}
        />
      </div>
    </div>
  );
}

export function BlockBacklinks(props: { entityID: string }) {
  let [open, setOpen] = useState(false);
  let backlinks = db.useReference(props.entityID, "block/inline-link-to");
  if (backlinks.length === 0) return null;
  return (
    <div className="flex flex-col">
      <button className="self-end text-xs" onClick={() => setOpen(!open)}>
        🔗 {backlinks.length}
      </button>
      {open && (
        <div>
          {backlinks.map((b) => (
            <Backlink entityID={b.entity} key={b.id} />
          ))}
        </div>
      )}
    </div>
  );
}

function Backlink(props: { entityID: string }) {
  let content = db.useEntity(props.entityID, "block/content");
  let { rep } = useMutations();
  let open = async () => {
    if (!rep) return;
    openBlock(props.entityID, rep);
  };
  return <span onClick={() => open()}>{content?.value}</span>;
}

export const BlockContent = (
  props: BlockProps & { firstChild?: string; blurred: boolean }
) => {
  let [cursorCoordinates, setCursorCoordinates] = useState<
    undefined | { top: number; left: number; textIndex: number }
  >();
  let setSuggestionPrefix = useAutocompleteState((s) => s.setSuggestionPrefix);
  let content = db.useEntity(props.entityID, "block/content");
  let previousSelection = useRef<null | { start: number; end: number }>();
  const onSelect = useCallback(
    (e: SyntheticEvent<HTMLTextAreaElement>) => {
      let value = e.currentTarget.value,
        start = e.currentTarget.selectionStart,
        end = e.currentTarget.selectionEnd;
      previousSelection.current = { start, end };
      if (start !== end) return setCursorCoordinates(undefined);

      let link = getLinkAtCursor(value, start);
      if (!link) {
        setSuggestionPrefix(undefined);
        setCursorCoordinates(undefined);
        return;
      }
      let coordinates = getCoordinatesInTextarea(e.currentTarget, link.start);
      let textareaPosition = e.currentTarget.getBoundingClientRect();
      setCursorCoordinates({
        textIndex: link.start,
        top:
          coordinates.top +
          textareaPosition.top +
          document.documentElement.scrollTop +
          coordinates.height,
        left: coordinates.left + textareaPosition.left,
      });
    },
    [setCursorCoordinates]
  );
  let { mutate, action } = useMutations();

  let textareaRef = useRef<HTMLTextAreaElement | null>(null);
  let timeout = useRef<null | number>(null);
  return (
    <>
      {cursorCoordinates && (
        <Autocomplete {...cursorCoordinates} onClick={() => {}} />
      )}
      <Textarea
        id={props.entityID}
        textareaRef={textareaRef}
        onSelect={onSelect}
        className={`h-full min-h-[24px] w-full scroll-m-12 bg-inherit ${
          props.blurred ? "opacity-25" : ""
        }
          `}
        value={content?.value || ""}
        onChange={async (e) => {
          if (!timeout.current) action.start();
          else clearTimeout(timeout.current);
          timeout.current = window.setTimeout(() => {
            timeout.current = null;
            action.end();
          }, 200);

          let value = e.currentTarget.value,
            start = e.currentTarget.selectionStart,
            end = e.currentTarget.selectionEnd;
          if (start !== end) return setCursorCoordinates(undefined);

          let link = getLinkAtCursor(value, start);
          setSuggestionPrefix(link?.value);
          if (!link) {
            setCursorCoordinates(undefined);
            setSuggestionPrefix(undefined);
          }
          if (link) {
            let coordinates = getCoordinatesInTextarea(
              e.currentTarget,
              link.start
            );

            let textareaPosition = e.currentTarget.getBoundingClientRect();
            setCursorCoordinates({
              textIndex: link.start,
              top:
                coordinates.top +
                textareaPosition.top +
                document.documentElement.scrollTop +
                coordinates.height,
              left: coordinates.left + textareaPosition.left,
            });
          }

          let previousStart = previousSelection.current?.start;
          let previousEnd = previousSelection.current?.end;
          action.add({
            undo: () => {
              textareaRef.current?.setSelectionRange(
                previousStart || null,
                previousEnd || null
              );
            },
            redo: () => {
              textareaRef.current?.setSelectionRange(start, end);
            },
          });
          await mutate("updateBlockContent", {
            block: props.entityID,
            content: value,
          });
          previousSelection.current = { start, end };
        }}
      />
    </>
  );
};

const ToggleOpen = (props: { entityID: string; count: number }) => {
  let expanded = useUIState((s) => s.openStates[props.entityID]);
  let setOpen = useUIState((s) => s.setOpen);
  return (
    <button
      className={`w-fit self-start pt-[10px] text-grey-35 ${props.count === 0 ? "opacity-0" : ""
        }`}
      onClick={() => {
        if (props.count > 0) setOpen(props.entityID, !expanded);
      }}
    >
      <Caret
        style={{
          transform:
            !expanded && props.count > 0 ? "rotate(-90deg)" : "rotate(0deg)",
        }}
      />
    </button>
  );
};

export function BlockChildren(props: {
  parentFocused: boolean;
  entityID: string;
  after?: string;
  depth: number;
}) {
  let children = db
    .useReference(props.entityID, "block/parent")
    ?.sort(sortByPosition);
  let expanded = useUIState((s) => s.openStates[props.entityID]);
  if (children?.length === 0 || !expanded) return null;
  return (
    <div className="flex flex-col gap-2 pt-2">
      {children?.map((block, index) => (
        <Block
          parentFocused={props.parentFocused}
          factID={block.id}
          before={children?.[index - 1]?.entity}
          after={children?.[index + 1]?.entity || props.after}
          key={block.entity}
          entityID={block.entity}
          parent={block.value.value}
          depth={props.depth + 1}
        />
      ))}
    </div>
  );
}
