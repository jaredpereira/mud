import { useAutocompleteState } from "components/Autocomplete";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { Fact } from "data/Facts";
import { useContext, useEffect } from "react";
import { scanIndex } from "src/replicache";
import { ulid } from "src/ulid";
import { sortByPosition } from "src/utils";
import { useMutations } from "./useReplicache";
import { getLastOpenChild, useUIState } from "./useUIState";

export const useKeyboardHandling = () => {
  let { mutate, action } = useMutations();
  let rep = useContext(ReplicacheContext)?.rep;

  return useEffect(() => {
    let cb = async (e: KeyboardEvent) => {
      let entity = useUIState.getState().focused;
      if (!entity) return;
      let entityID = entity;
      let el = e.target as HTMLTextAreaElement;
      let value = el?.value,
        start = el?.selectionStart,
        end = el?.selectionEnd;

      let ref = {
        current: document.getElementById(entityID) as
          | HTMLTextAreaElement
          | undefined,
      };
      const getSuggestions = async () => {
        let state = useAutocompleteState.getState();
        let suggestions: Fact<"block/unique-name">[] = [];
        if (state.suggestionPrefix) {
          suggestions = (
            (await rep?.query((tx) =>
              scanIndex(tx).aev("block/unique-name")
            )) || []
          ).filter((title) =>
            title.value
              .toLocaleLowerCase()
              .includes(state.suggestionPrefix?.toLocaleLowerCase() || "")
          );
        }
        return {
          suggestions,
          ...state,
        };
      };
      let getFirstChild = async () => {
        if (!rep) return undefined;
        return (
          await rep.query((tx) => scanIndex(tx).vae(entityID, "block/parent"))
        ).sort(sortByPosition)[0]?.entity;
      };
      let getAfter = async () => {
        if (!rep) return;
        let parent = await rep.query((tx) =>
          scanIndex(tx).eav(entityID, "block/parent")
        );
        if (!parent) return;
        let parentEntity = parent.value.value;
        let siblings = (
          await rep.query((tx) =>
            scanIndex(tx).vae(parentEntity, "block/parent")
          )
        ).sort(sortByPosition);
        let index = siblings.findIndex((s) => s.entity === entityID);
        if (index === -1) return;
        return siblings[index + 1].entity;
      };
      let getParent = async () => {
        if (!rep) return;
        let parent = await rep.query((tx) =>
          scanIndex(tx).eav(entityID, "block/parent")
        );
        if (!parent) return;
        return parent.entity;
      };
      const getBefore = async () => {
        if (!rep) return;
        let parent = await rep.query((tx) =>
          scanIndex(tx).eav(entityID, "block/parent")
        );
        if (!parent) return;
        let parentEntity = parent.value.value;
        let siblings = (
          await rep.query((tx) =>
            scanIndex(tx).vae(parentEntity, "block/parent")
          )
        ).sort(sortByPosition);
        let index = siblings.findIndex((s) => s.entity === entityID);
        if (index === -1) return;
        return siblings[index - 1].entity;
      };
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
              setTimeout(() => {
                ref?.current?.setSelectionRange(start, end);
              }, 10);
            },
            redo: () => {
              setTimeout(() => {
                ref?.current?.setSelectionRange(
                  cursors[0] + offset,
                  cursors[1] + offset
                );
              }, 10);
            },
          });
        await mutate("updateBlockContent", {
          block: entityID,
          content: newValue,
        });
        setTimeout(() => {
          ref?.current?.setSelectionRange(
            cursors[0] + offset,
            cursors[1] + offset
          );
        }, 10);
        if (undo) action.end();
      };

      switch (e.key) {
        case "Escape": {
          if (useAutocompleteState.getState().suggestionPrefix) {
            e.preventDefault();
            useAutocompleteState.setState(() => ({
              suggestionPrefix: undefined,
            }));
          }
          break;
        }
        case "Enter": {
          let s = await getSuggestions();

          if (s.suggestions.length > 0) {
            e.preventDefault();

            let value = s.suggestions[s.suggestionIndex] || s.suggestions[0];
            if (!value) break;
            if (!s.suggestionPrefix) break;
            transact(
              (text) => {
                if (!s.suggestionPrefix) return;
                text.delete(
                  start - s.suggestionPrefix.length,
                  s.suggestionPrefix.length
                );
                text.insert(start - s.suggestionPrefix.length, value.value);
              },
              2 - s.suggestionPrefix.length,
              true
            );
            close();
            break;
          }
          if (e.ctrlKey && !e.shiftKey) {
            useUIState.setState((s) => ({
              openStates: {
                ...s.openStates,
                [entityID]: !s.openStates[entityID],
              },
            }));
            break;
          }
          if (!e.shiftKey || e.ctrlKey) {
            e.preventDefault();
            let child = ulid();
            if (e.ctrlKey) {
              useUIState.setState((s) => ({
                openStates: {
                  ...s.openStates,
                  [entityID]: true,
                },
              }));
              await mutate("addChildBlock", {
                factID: ulid(),
                parent: entityID,
                child,
              });
            } else {
              let parent = await getParent();
              if (!parent) return;
              await mutate("addChildBlock", {
                factID: ulid(),
                parent:
                  useUIState.getState().root === entityID ? entityID : parent,
                after: entityID,
                child,
              });
            }
            useUIState.setState(() => ({ focused: child }));
            document.getElementById(child)?.focus();
            break;
          }
          break;
        }
        case "Tab": {
          e.preventDefault();
          let s = await getSuggestions();
          if (s.suggestions.length > 0) {
            if (e.shiftKey) {
              if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
            } else {
              if (s.suggestionIndex < s.suggestions.length - 1)
                s.setSuggestionIndex((i) => i + 1);
            }
            break;
          } else {
            if (e.shiftKey) {
              await mutate("outdentBlock", { factID: ulid(), entityID });
            } else {
              let previousSibling = await getBefore();
              if (!previousSibling) break;
              let p = previousSibling;
              useUIState.setState((s) => ({
                openStates: {
                  ...s.openStates,
                  [p]: true,
                },
              }));
              await mutate("indentBlock", { factID: ulid(), entityID });
            }
            keepFocus();
          }
          break;
        }
        case "ArrowUp": {
          let s = await getSuggestions();
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
            break;
          }
          break;
        }
        case "ArrowDown": {
          let s = await getSuggestions();
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex < s.suggestions.length - 1)
              s.setSuggestionIndex((i) => i + 1);
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
          let nextspace = value.slice(0, start - 1).lastIndexOf(" ");
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
          let nextspace = value.slice(start).indexOf(" ");
          if (nextspace > 0)
            ref?.current?.setSelectionRange(
              start + nextspace + 1,
              start + nextspace + 1
            );
          else ref?.current?.setSelectionRange(value.length, value.length);
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
          let s = await getSuggestions();
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
            break;
          } else {
            e.preventDefault();
            let previousSibling = await getBefore();
            if (previousSibling) {
              let p = previousSibling;
              if (!rep) return;
              let lastchild = await rep.query((tx) => getLastOpenChild(tx, p));
              document.getElementById(lastchild)?.focus();
            } else {
              let parent = await getParent();
              if (parent) document.getElementById(parent)?.focus();
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
          let s = await getSuggestions();
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex < s.suggestions.length - 1)
              s.setSuggestionIndex((i) => i + 1);
            break;
          } else {
            e.preventDefault();
            let firstChild = await getFirstChild();
            if (
              firstChild &&
              (useUIState.getState().openStates[entityID] ||
                useUIState.getState().root === entityID)
            )
              document.getElementById(firstChild)?.focus();
            else {
              let after = await getAfter();
              if (after) document.getElementById(after)?.focus();
            }
          }
          break;
        }
        case ":": {
          if (e.ctrlKey) {
            e.preventDefault();
            useUIState.getState().setRoot(entityID);
            keepFocus();
          }
          break;
        }

        case "H": {
          if (e.ctrlKey) {
            e.preventDefault();
            let root = useUIState.getState().root;
            let parent = await getParent();
            if (root === entityID) {
              if (
                parent ===
                (await rep?.query((tx) => scanIndex(tx).aev("home")))?.[0]
                  ?.entity
              )
                useUIState.getState().setRoot(undefined);
              else {
                useUIState.getState().setRoot(parent);
                useUIState.getState().setFocused(parent);
              }
              keepFocus();
            }
            if (parent) document.getElementById(parent)?.focus();
          }
          break;
        }
        case "o": {
          if (e.ctrlKey) {
            e.preventDefault();
            useUIState.getState().setOpen(entityID, true);
          }
          break;
        }
        case "c": {
          if (e.ctrlKey) {
            e.preventDefault();
            useUIState.getState().setOpen(entityID, false);
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
            useUIState.setState((s) => {
              if (s.root === entityID) return { root: undefined };
              return {};
            });
            action.end();
            let id: string | undefined;
            let previousSibling = await getBefore();
            if (previousSibling) {
              let p = previousSibling;
              if (!rep) return;
              id = await rep.query((tx) => getLastOpenChild(tx, p));
            } else {
              id = await getParent();
            }
            if (id) document.getElementById(id)?.focus();
            setTimeout(() => {
              if (!id) return;
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
            if (value[start] === "*" && value[start - 2] !== " ") {
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
          if (e.ctrlKey || e.altKey || e.metaKey) break;
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
          if (e.ctrlKey || e.altKey || e.metaKey) break;
          if (start === end) {
            if (value[start] === "]") {
              e.preventDefault();
              ref?.current?.setSelectionRange(start + 1, start + 1);
            }
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", cb);
    return () => {
      window.removeEventListener("keydown", cb);
    };
  }, [rep]);
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
