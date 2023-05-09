import { BlockProps } from "components/Block";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { Fact } from "data/Facts";
import { useCallback, useContext } from "react";
import { ulid } from "src/ulid";
import { getLastChild } from "src/utils";
import { useMutations } from "./useReplicache";

export const useKeyboardHandling = (
  deps: {
    firstChild?: string;
    suggestions: Fact<"block/content">[];
    close: () => void;
    cursorCoordinates?: { textIndex: number };
    suggestionPrefix?: string;
    suggestionIndex: number;
    setSuggestionIndex: (x: number | ((x: number) => number)) => void;
  } & BlockProps
) => {
  let { mutate, action } = useMutations();
  let rep = useContext(ReplicacheContext)?.rep;

  let {
    parent,
    entityID,
    suggestions,
    setSuggestionIndex,
    cursorCoordinates,
    close,
    suggestionIndex,
    suggestionPrefix,
  } = deps;
  return useCallback(
    async (
      e: React.KeyboardEvent<HTMLTextAreaElement>,
      ref?: React.MutableRefObject<HTMLTextAreaElement | null>
    ) => {
      let value = e.currentTarget.value,
        start = e.currentTarget.selectionStart,
        end = e.currentTarget.selectionEnd;
      const keepFocus = () => {
        document.getElementById(entityID)?.focus();
        setTimeout(() => {
          document
            .getElementById(entityID)
            //@ts-ignore
            ?.setSelectionRange?.(start, end);
        }, 10);
      };
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
          attribute: "block/content",
          value: newValue,
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
          if (e.ctrlKey) {
            let child = ulid();
            await mutate("addChildBlock", {
              factID: ulid(),
              parent: parent,
              after: entityID,
              child,
            });
            document.getElementById(child)?.focus();
            break;
          }
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            let value = suggestions[suggestionIndex] || suggestions[0];
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
        case "Tab": {
          e.preventDefault();
          if (suggestions.length > 0 && !!cursorCoordinates) {
            if (e.shiftKey) {
              if (suggestionIndex > 0) setSuggestionIndex((i) => i - 1);
            } else {
              if (suggestionIndex < suggestions.length - 1)
                setSuggestionIndex((i) => i + 1);
            }
            break;
          } else {
            if (e.shiftKey) {
              await mutate("outdentBlock", { factID: ulid(), entityID });
            } else {
              if (!deps.before) break;
              await mutate("indentBlock", { factID: ulid(), entityID });
            }
            keepFocus();
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

        case "l": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          await mutate("indentBlock", { entityID, factID: ulid() });
          keepFocus();
          break;
        }

        case "h": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          await mutate("outdentBlock", { entityID, factID: ulid() });
          keepFocus();
          break;
        }
        case "K": {
          if (!e.ctrlKey) break;
          e.preventDefault();

          if (deps.before) {
            let before = deps.before;
            if (!rep) return;
            let lastchild = await rep.query((tx) => getLastChild(tx, before));
            document.getElementById(lastchild)?.focus();
          } else {
            document.getElementById(deps.parent)?.focus();
          }
          break;
        }
        case "k": {
          if (!e.ctrlKey) break;
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex > 0) setSuggestionIndex((i) => i - 1);
            break;
          } else {
            e.preventDefault();
            await mutate("moveBlockUp", { entityID });
          }
          break;
        }
        case "J": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          if (deps.firstChild)
            document.getElementById(deps.firstChild)?.focus();
          else if (deps.after) document.getElementById(deps.after)?.focus();
          break;
        }
        case "j": {
          if (!e.ctrlKey) break;
          if (suggestions.length > 0 && !!cursorCoordinates) {
            e.preventDefault();
            if (suggestionIndex < suggestions.length - 1)
              setSuggestionIndex((i) => i + 1);
            break;
          } else {
            e.preventDefault();

            await mutate("moveBlockDown", { entityID });
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
          if (value === "") {
            mutate("deleteBlock", { entity: entityID });
          }

          break;
        }
        case "i": {
          if (!e.ctrlKey) break;
          if (start !== end) {
            transact((text) => {
              text.insert(start, "*");
              text.insert(end + 1, "*");
            });
            //React seems to change the selection state if you set the value to something the current value is not
          }
          break;
        }
        case "b": {
          if (!e.ctrlKey) break;
          if (start !== end) {
            transact((text) => {
              text.insert(start, "**");
              text.insert(end + 2, "**");
            });
            //React seems to change the selection state if you set the value to something the current value is not
          }
          break;
        }
        case "*": {
          if (e.ctrlKey || e.altKey) break;
          e.preventDefault();
          if (start !== end) {
            transact((text) => {
              text.insert(start, "*");
              text.insert(end + 1, "*");
            });
            //React seems to change the selection state if you set the value to something the current value is not
          } else {
            if (e.currentTarget.value[start] === "*") {
              e.preventDefault();
              ref?.current?.setSelectionRange(start + 1, start + 1);
            } else
              transact((text) => {
                text.insert(start, "**");
              }, 1);
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
    [...Object.values(deps), rep]
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
