import { FilterAttributes } from "data/Attributes";
import { Fact } from "data/Facts";
import { useCallback } from "react";
import { useMutations } from "./useReplicache";

export const useKeyboardHandling = (deps: {
  entityID: string;
  section: keyof FilterAttributes<{
    unique: any;
    type: "string";
    cardinality: "one";
  }>;
  suggestions: Fact<"card/title">[];
  close: () => void;
  cursorCoordinates?: { textIndex: number };
  suggestionPrefix?: string;
  suggestionIndex: number;
  setSuggestionIndex: (x: number | ((x: number) => number)) => void;
}) => {
  let { mutate, action } = useMutations();

  let {
    entityID,
    section,
    suggestions,
    setSuggestionIndex,
    cursorCoordinates,
    close,
    suggestionIndex,
    suggestionPrefix,
  } = deps;
  return useCallback(
    (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      ref?: React.MutableRefObject<HTMLTextAreaElement | null>
    ) => {
      let value = e.currentTarget.value,
        start = e.currentTarget.selectionStart,
        end = e.currentTarget.selectionEnd;
      let transact = async (
        transaction: Transaction,
        offset: number = 0,
        undo?: boolean
      ) => {
        if (undo) action.start();
        let [newValue, cursors] = modifyString(
          value,
          [start, end],
          transaction
        );

        if (undo)
          action.add({
            undo: () => {
              ref?.current?.setSelectionRange(start, end);
            },
            redo: () => {
              ref?.current?.setSelectionRange(
                cursors[0] + offset,
                cursors[1] + offset
              );
            },
          });
        await mutate("assertFact", {
          entity: entityID,
          attribute: section,
          value: newValue,
          positions: {},
        });
        ref?.current?.setSelectionRange(
          cursors[0] + offset,
          cursors[1] + offset
        );
        if (undo) action.end();
      };

      switch (e.key) {
        case "Escape": {
          if (suggestions.length > 0) {
            console.log(suggestions);
            e.preventDefault();
            close();
          }
          break;
        }
        case "Enter": {
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            let value = suggestions[suggestionIndex];
            if (!value) break;
            // TODO write the text!
            if (!suggestionPrefix) break;
            transact(
              (text) => {
                if (!cursorCoordinates || !suggestionPrefix) return;
                text.delete(
                  cursorCoordinates.textIndex,
                  suggestionPrefix.length
                );
                text.insert(cursorCoordinates.textIndex, value.value);
              },
              2 - suggestionPrefix.length,
              true
            );
            close();
            break;
          }
          break;
        }
        case "ArrowUp": {
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex > 0) setSuggestionIndex((i) => i - 1);
            break;
          }
          break;
        }
        case "ArrowDown": {
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex < suggestions.length - 1)
              setSuggestionIndex((i) => i + 1);
            break;
          }
          break;
        }

        case "k": {
          if (!e.ctrlKey) break;
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex > 0) setSuggestionIndex((i) => i - 1);
            break;
          }
          break;
        }
        case "j": {
          if (!e.ctrlKey) break;
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex < suggestions.length - 1)
              setSuggestionIndex((i) => i + 1);
            break;
          }
          break;
        }
        case "Backspace": {
          if (
            value[start - 1] === "[" &&
            value[start] === "]" &&
            start === end
          ) {
            e.preventDefault();
            transact((text) => {
              text.delete(start - 1, 2);
            }, -1);
            break;
          }

          if (
            value[start - 2] === "[" &&
            value[start - 1] === "]" &&
            start === end
          ) {
            e.preventDefault();
            transact((text) => {
              text.delete(start - 2, 2);
            }, -2);
            break;
          }

          break;
        }
        case "[": {
          if (e.ctrlKey || e.altKey) break;
          e.preventDefault();
          if (start !== end) {
            transact((text) => {
              text.insert(start, "[");
              text.insert(end + 1, "]");
            });
            //React seems to change the selection state if you set the value to something the current value is not
          } else {
            transact((text) => {
              text.insert(start, "[]");
            }, 1);
          }
          break;
        }
        case "]": {
          if (e.ctrlKey || e.altKey) break;
          let start = e.currentTarget.selectionStart,
            end = e.currentTarget.selectionEnd;
          if (start === end) {
            if (e.currentTarget.value[start] === "]") {
              e.preventDefault();
              ref?.current?.setSelectionRange(start + 1, start + 1);
            }
          }
          break;
        }
      }
    },
    [
      suggestions,
      setSuggestionIndex,
      cursorCoordinates,
      close,
      suggestionIndex,
      suggestionPrefix,
    ]
  );
};

export type Transaction = (tx: {
  insert: (i: number, s: string) => void;
  delete: (i: number, l: number) => void;
}) => void;
export function modifyString(
  input: string,
  initialCursor: number[],
  transact: Transaction
): [string, number[]] {
  let output = input;
  let cursors = initialCursor;
  transact({
    insert: (i: number, s: string) => {
      output = output.slice(0, i) + s + output.slice(i);
      cursors = cursors.map((c) => {
        if (i < c) return c + s.length;
        return c;
      });
    },
    delete: (i: number, l: number) => {
      output = output.slice(0, i) + output.slice(i + l);
      cursors = cursors.map((c) => {
        if (i > c) return c - l;
        return c;
      });
    },
  });
  return [output, cursors];
}
