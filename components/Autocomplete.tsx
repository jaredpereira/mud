import * as Popover from "@radix-ui/react-popover";
import { db } from "hooks/useReplicache";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { combine } from "zustand/middleware";

export const Autocomplete = (props: {
  top: number;
  left: number;
  onClick: (item: string) => void;
}) => {
  const previousSelected = useRef(0);
  let suggestionPrefix = useAutocompleteState((s) => s.suggestionPrefix);
  let suggestionIndex = useAutocompleteState((s) => s.suggestionIndex);
  useEffect(() => {
    previousSelected.current === suggestionIndex;
  });
  let names = db.useAttribute(suggestionPrefix ? "block/unique-name" : null);

  let suggestions = !suggestionPrefix
    ? []
    : names.filter((title) =>
        title.value
          .toLocaleLowerCase()
          .includes(suggestionPrefix?.toLocaleLowerCase() || "")
      );
  useEffect(() => {
    if (suggestionIndex > suggestions.length - 1)
      useAutocompleteState.setState(() => ({
        suggestionIndex: suggestions.length - 1,
      }));
  }, [suggestionIndex, suggestions]);
  if (!suggestionPrefix || suggestions.length === 0) return null;

  return (
    <Popover.Root open>
      {createPortal(
        <Popover.Anchor
          style={{
            top: props.top,
            left: props.left,
            position: "absolute",
          }}
        />,
        document.body
      )}
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="center"
          sideOffset={4}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="rounded-sm z-10 max-h-32 w-64 overflow-y-scroll border bg-white py-1 text-grey-35"
        >
          <ul>
            {suggestions.map((result, index) => {
              return (
                <ListItem
                  key={result.id}
                  onClick={props.onClick}
                  previousSelectedIndex={previousSelected.current}
                  index={index}
                  selectedIndex={suggestionIndex}
                  value={result.value}
                />
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

const ListItem = (props: {
  value: string;
  index: number;
  onClick: (item: string) => void;
  previousSelectedIndex: number;
  selectedIndex: number;
}) => {
  let el = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (el.current && props.selectedIndex === props.index) {
      el.current.scrollIntoView({
        block: "nearest",
      });
    }
  }, [el, props.index, props.selectedIndex]);
  return (
    <>
      <style jsx>
        {`
          .autocomplete-hover:hover {
            @apply bg-bg-blue;
            cursor: pointer;
          }
        `}
      </style>
      <li
        ref={el}
        onMouseDown={(e) => {
          e.preventDefault();
          props.onClick(props.value);
        }}
        className={`autocomplete-hover py-1 px-2 ${
          props.index === props.selectedIndex ? "bg-bg-blue" : ""
        }`}
      >
        {props.value}
      </li>
    </>
  );
};

export const useAutocompleteState = create(
  combine(
    {
      suggestionPrefix: undefined as string | undefined,
      suggestionIndex: 0,
    },
    (set) => ({
      setSuggestionPrefix: (prefix: string | undefined) => {
        set({ suggestionPrefix: prefix });
      },
      setSuggestionIndex: (newIndex: (n: number) => number) => {
        set((s) => ({ suggestionIndex: newIndex(s.suggestionIndex) }));
      },
    })
  )
);
