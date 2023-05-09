import { Autocomplete, useSuggestions } from "components/Autocomplete";
import { Textarea } from "components/Textarea";
import { useKeyboardHandling } from "hooks/useKeyboardHandling";
import { db, useMutations } from "hooks/useReplicache";
import { SyntheticEvent, useCallback, useRef, useState } from "react";
import { getCoordinatesInTextarea } from "src/getCoordinatesInTextarea";
import { getLinkAtCursor, sortByPosition } from "src/utils";

export type BlockProps = {
  factID: string;
  entityID: string;
  parent: string;
  before?: string;
  after?: string;
};

export function Block(props: BlockProps) {
  let suggestions = useSuggestions();
  let content = db.useEntity(props.entityID, "block/content");
  let [cursorCoordinates, setCursorCoordinates] = useState<
    undefined | { top: number; left: number; textIndex: number }
  >();
  let previousSelection = useRef<null | { start: number; end: number }>();
  let children = db
    .useReference(props.entityID, "block/parent")
    ?.sort(sortByPosition);
  let onKeyDown = useKeyboardHandling({
    ...props,
    firstChild: children?.[0]?.entity,
    cursorCoordinates,
    ...suggestions,
  });

  const onSelect = useCallback(
    (e: SyntheticEvent<HTMLTextAreaElement>) => {
      let value = e.currentTarget.value,
        start = e.currentTarget.selectionStart,
        end = e.currentTarget.selectionEnd;
      previousSelection.current = { start, end };
      if (start !== end) return setCursorCoordinates(undefined);

      let link = getLinkAtCursor(value, start);
      if (!link) {
        suggestions.setSuggestionPrefix(undefined);
        setCursorCoordinates(undefined);
        suggestions.close();
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
    <div className="border p-3">
      {cursorCoordinates && suggestions.suggestionPrefix && (
        <Autocomplete
          {...suggestions}
          {...cursorCoordinates}
          onClick={() => {}}
        />
      )}
      <Textarea
        id={props.entityID}
        textareaRef={textareaRef}
        onSelect={onSelect}
        onKeyDown={onKeyDown}
        className={`h-full min-h-[24px] w-full bg-inherit`}
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
          suggestions.setSuggestionPrefix(link?.value);
          if (!link) {
            setCursorCoordinates(undefined);
            suggestions.close();
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
          await mutate("assertFact", {
            entity: props.entityID,
            attribute: "block/content",
            value: value,
          });
          previousSelection.current = { start, end };
        }}
      />
      <BlockChildren entityID={props.entityID} after={props.after} />
    </div>
  );
}

export function BlockChildren(props: { entityID: string; after?: string }) {
  let children = db
    .useReference(props.entityID, "block/parent")
    ?.sort(sortByPosition);
  if (children?.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 pt-2">
      {children?.map((block, index) => (
        <Block
          factID={block.id}
          before={children?.[index - 1]?.entity}
          after={children?.[index + 1]?.entity || props.after}
          key={block.entity}
          entityID={block.entity}
          parent={block.value.value}
        />
      ))}
    </div>
  );
}
