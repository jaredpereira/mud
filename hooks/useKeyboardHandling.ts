import { BlockProps } from "components/Block";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { Fact } from "data/Facts";
import { useCallback, useContext } from "react";
import { getLastOpenChild, useOpenStates } from "src/openStates";
import { ulid } from "src/ulid";
import { useMutations } from "./useReplicache";
import { useUIState } from "./useUIState";

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
        }, 50);
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
            e.preventDefault();
            close();
          }
          break;
        }
        case "Enter": {
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
          if (e.ctrlKey) {
            useOpenStates.setState((s) => ({
              openStates: {
                ...s.openStates,
                [entityID]: !s.openStates[entityID],
              },
            }));
            break;
          }
          if (!e.shiftKey) {
            e.preventDefault();
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
              let before = deps.before;
              useOpenStates.setState((s) => ({
                openStates: {
                  ...s.openStates,
                  [before]: true,
                },
              }));
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
        case "h": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          if (start !== end) return;
          if (!e.altKey) {
            ref?.current?.setSelectionRange(start - 1, start - 1);
            break;
          }
          let nextspace = e.currentTarget.value
            .slice(0, start - 1)
            .lastIndexOf(" ");
          if (nextspace > 0)
            ref?.current?.setSelectionRange(nextspace + 1, nextspace + 1);
          else ref?.current?.setSelectionRange(0, 0);
          break;
        }
        case "l": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          if (start !== end) return;
          if (!e.altKey) {
            ref?.current?.setSelectionRange(start + 1, start + 1);
            break;
          }
          let nextspace = e.currentTarget.value.slice(start).indexOf(" ");
          if (nextspace > 0)
            ref?.current?.setSelectionRange(
              start + nextspace + 1,
              start + nextspace + 1
            );
          else
            ref?.current?.setSelectionRange(
              e.currentTarget.value.length,
              e.currentTarget.value.length
            );
          break;
        }

        case "K": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          await mutate("moveBlockUp", { entityID });
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

            if (deps.before) {
              let before = deps.before;
              if (!rep) return;
              let lastchild = await rep.query((tx) =>
                getLastOpenChild(tx, before)
              );
              document.getElementById(lastchild)?.focus();
            } else {
              document.getElementById(deps.parent)?.focus();
            }
          }
          break;
        }
        case "J": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          await mutate("moveBlockDown", { entityID });
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
            if (
              deps.firstChild &&
              useOpenStates.getState().openStates[entityID]
            )
              document.getElementById(deps.firstChild)?.focus();
            else if (deps.after) document.getElementById(deps.after)?.focus();
          }
          break;
        }
        case "o": {
          if (e.ctrlKey) {
            e.preventDefault();
            useOpenStates.getState().setOpen(entityID, true);
          }
          break;
        }
        case "c": {
          if (e.ctrlKey) {
            e.preventDefault();
            useOpenStates.getState().setOpen(entityID, false);
          }
          break;
        }

        case "Backspace": {
          if (
            value[start - 1] === "*" &&
            value[start] === "*" &&
            start === end
          ) {
            e.preventDefault();
            transact((text) => {
              text.delete(start - 1, 2);
            }, -1);
            break;
          }
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
            e.preventDefault();
            action.start();
            action.add({
              undo: async () => {
                document.getElementById(entityID)?.focus();
              },
              redo: () => {},
            });
            await mutate("deleteBlock", { entity: entityID });
            action.end();
            let id: string;
            if (deps.before) {
              let before = deps.before;
              if (!rep) return;
              id = await rep.query((tx) => getLastOpenChild(tx, before));
            } else {
              id = deps.parent;
            }
            document.getElementById(id)?.focus();
            setTimeout(() => {
              let el = document.getElementById(id);
              //@ts-ignore
              el?.setSelectionRange?.(el.value.length, el.value.length);
            }, 10);
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
          } else {
            if (
              e.currentTarget.value[start] === "*" &&
              e.currentTarget.value[start - 2] !== " "
            ) {
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
