import { useAutocompleteState } from "components/Autocomplete";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { Fact } from "data/Facts";
import { useContext, useEffect } from "react";
import { Replicache } from "replicache";
import { generateKeyBetween } from "src/fractional-indexing";
import { scanIndex } from "src/replicache";
import { ulid } from "src/ulid";
import { modifyString, sortByPosition, Transaction } from "src/utils";
import { useMutations } from "./useReplicache";
import { getLastOpenChild, useUIState } from "./useUIState";

export const useKeyboardHandling = () => {
  let m = useMutations();
  let { mutate, action } = m;
  let rep = useContext(ReplicacheContext)?.rep;

  return useEffect(() => {
    let cb = async (e: KeyboardEvent) => {
      let entity = useUIState.getState().focused;
      let entityID = entity;
      if (!rep) return;
      let el = e.target as HTMLTextAreaElement;
      let value = el?.value,
        start = el?.selectionStart,
        end = el?.selectionEnd;

      let ref = {
        current: entityID
          ? (document.getElementById(entityID) as HTMLTextAreaElement)
          : undefined,
      };
      let transact = async (
        transaction: Transaction,
        offset: number = 0,
        undo?: boolean
      ) => {
        if (!entityID) return;
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
      for (let shortcut of shortcuts) {
        if (
          shortcut.key === e.key &&
          !!shortcut.ctrlKey === !!e.ctrlKey &&
          !!shortcut.shiftKey === !!e.shiftKey
        ) {
          e.preventDefault();
          shortcut.callback({
            entityID,
            ref,
            start,
            end,
            value,
            transact,
            ...m,
            rep,
          });
          return;
        }
      }

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
        case "ArrowUp": {
          let s = await getSuggestions(rep);
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
            break;
          }
          break;
        }
        case "ArrowDown": {
          let s = await getSuggestions(rep);
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
        case "k": {
          if (!e.ctrlKey) break;
          let s = await getSuggestions(rep);
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
            break;
          } else {
            e.preventDefault();
            if (!entityID) {
              let root =
                useUIState.getState().root ||
                (await rep.query((tx) => scanIndex(tx).aev("home")))[0]?.entity;
              if (!root) return;
              let children = await rep.query((tx) =>
                scanIndex(tx).vae(root, "block/parent")
              );
              let lastchild =
                children.sort(sortByPosition)[children.length - 1]?.entity;

              document.getElementById(lastchild)?.focus();
              return;
            }
            let previousSibling = await getBefore(entityID, rep);
            if (previousSibling) {
              let p = previousSibling;
              if (!rep) return;
              let lastchild = await rep.query((tx) => getLastOpenChild(tx, p));
              document.getElementById(lastchild)?.focus();
            } else {
              let parent = await getParent(entityID, rep);
              if (parent) document.getElementById(parent)?.focus();
            }
          }
          break;
        }
        case "j": {
          if (!e.ctrlKey) break;
          let s = await getSuggestions(rep);
          if (s.suggestions.length > 0) {
            e.preventDefault();
            if (s.suggestionIndex < s.suggestions.length - 1)
              s.setSuggestionIndex((i) => i + 1);
            break;
          } else {
            e.preventDefault();
            if (!entityID) {
              let root =
                useUIState.getState().root ||
                (await rep.query((tx) => scanIndex(tx).aev("home")))[0]?.entity;
              if (!root) return;
              let children = await rep.query((tx) =>
                scanIndex(tx).vae(root, "block/parent")
              );
              let firstChild = children.sort(sortByPosition)[0]?.entity;

              document.getElementById(firstChild)?.focus();
              return;
            }
            let firstChild = await getFirstChild(entityID, rep);
            if (
              firstChild &&
              (useUIState.getState().openStates[entityID] ||
                useUIState.getState().root === entityID)
            )
              document.getElementById(firstChild)?.focus();
            else {
              let after = await getAfter(entityID, rep);
              if (after) document.getElementById(after)?.focus();
            }
          }
          break;
        }
        case ":": {
          if (e.ctrlKey) {
            e.preventDefault();
            if (!entityID) return;
            useUIState.getState().setRoot(entityID);
            keepFocus(entityID, start, end);
          }
          break;
        }

        case "Backspace": {
          if (!entityID) return;
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
                if (entityID) document.getElementById(entityID)?.focus();
              },
              redo: () => {},
            });
            useUIState.setState((s) => {
              if (s.root === entityID) return { root: undefined };
              return {};
            });
            action.end();
            let id: string | undefined;
            let previousSibling = await getBefore(entityID, rep);
            if (previousSibling) {
              let p = previousSibling;
              if (!rep) return;
              id = await rep.query((tx) => getLastOpenChild(tx, p));
            } else {
              id = await getParent(entityID, rep);
            }

            await mutate("deleteBlock", { entity: entityID });
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

const shortcuts: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  description: string;
  callback: (
    ctx: {
      entityID?: string;
      ref: { current?: HTMLTextAreaElement };
      start: number;
      end: number;
      value: string;
      transact: (
        transaction: Transaction,
        offset: number,
        undo?: boolean
      ) => void;
    } & ReturnType<typeof useMutations>
  ) => void;
}[] = [
  {
    key: "Tab",
    description: "Indent block",
    callback: async ({ entityID, rep, mutate }) => {
      if (!entityID) return;
      let s = await getSuggestions(rep);
      if (
        s.suggestions.length > 0 &&
        s.suggestionIndex < s.suggestions.length - 1
      ) {
        s.setSuggestionIndex((i) => i + 1);
        return;
      }
      let previousSibling = await getBefore(entityID, rep);
      if (!previousSibling) return;
      let p = previousSibling;
      useUIState.setState((s) => ({
        openStates: {
          ...s.openStates,
          [p]: true,
        },
      }));
      await mutate("indentBlock", { factID: ulid(), entityID });
    },
  },
  {
    key: "y",
    ctrlKey: true,
    description: "Yank (cut) a block",
    callback: ({ entityID }) => {
      useUIState.setState((s) => {
        if (s.yankedBlock === entityID)
          return {
            yankedBlock: undefined,
          };
        return {
          yankedBlock: entityID,
        };
      });
    },
  },
  {
    key: "p",
    ctrlKey: true,
    description: "Paste a yanked block",
    callback: async ({ entityID, mutate, rep }) => {
      if (!entityID) return;
      let yankee = useUIState.getState().yankedBlock;
      if (!yankee || !rep) return;
      let children = await rep.query((tx) =>
        scanIndex(tx).vae(entityID, "block/parent")
      );
      useUIState.getState().setOpen(entityID, true);
      useUIState.setState(() => ({ yankedBlock: undefined }));
      await mutate("assertFact", {
        factID: ulid(),
        entity: yankee,
        attribute: "block/parent",
        value: {
          value: entityID,
          type: "parent",
          position: generateKeyBetween(
            null,
            children.sort(sortByPosition)[0]?.value.position || null
          ),
        },
      });
    },
  },
  {
    key: "Tab",
    shiftKey: true,
    description: "Outdent block",
    callback: async ({ entityID, mutate, rep }) => {
      if (!entityID) return;
      let s = await getSuggestions(rep);
      if (s.suggestions.length > 0 && s.suggestionIndex > 0) {
        s.setSuggestionIndex((i) => i - 1);
        return;
      }
      await mutate("outdentBlock", { factID: ulid(), entityID });
    },
  },
  {
    key: "Enter",
    description: "Expand or collapse children",
    ctrlKey: true,
    callback: ({ entityID }) => {
      useUIState.setState((s) => {
        if (entityID)
          return {
            openStates: {
              ...s.openStates,
              [entityID]: !s.openStates[entityID],
            },
          };
        return {};
      });
    },
  },
  {
    key: "Enter",
    description: "create new child block",
    ctrlKey: true,
    shiftKey: true,
    callback: async ({ mutate, entityID, start, value }) => {
      if (!entityID) return;
      let e = entityID;
      let child = ulid();
      let oldBlockContent = value.slice(0, start);
      let newBlockContent = value.slice(start);
      useUIState.setState((s) => ({
        openStates: {
          ...s.openStates,
          [e]: true,
        },
      }));
      await mutate("updateBlockContent", {
        block: child,
        content: newBlockContent,
      });
      await mutate("updateBlockContent", {
        block: entityID,
        content: oldBlockContent,
      });
      await mutate("addChildBlock", {
        factID: ulid(),
        parent: entityID,
        child,
      });
      useUIState.setState(() => ({ focused: child }));
      document.getElementById(child)?.focus();
      setTimeout(() => {
        let el = document.getElementById(child) as
          | HTMLTextAreaElement
          | undefined;
        el?.setSelectionRange(0, 0);
      }, 10);
    },
  },
  {
    key: "Enter",
    description: "Create a new sibling block",
    callback: async ({
      mutate,
      entityID,
      rep,
      transact,
      start,
      value,
      action,
    }) => {
      if (!entityID) return;
      let s = await getSuggestions(rep);
      if (s.suggestions.length > 0) {
        let value = s.suggestions[s.suggestionIndex] || s.suggestions[0];
        if (!value) return;
        if (!s.suggestionPrefix) return;
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
        useAutocompleteState.getState().setSuggestionPrefix(undefined);
        return;
      }
      let child = ulid();
      let oldBlockContent = value.slice(0, start);
      let newBlockContent = value.slice(start);
      let parent = await getParent(entityID, rep);
      if (!parent) return;
      action.start();
      await mutate("addChildBlock", {
        factID: ulid(),
        parent: useUIState.getState().root === entityID ? entityID : parent,
        after: entityID,
        child,
      });
      await mutate("updateBlockContent", {
        block: child,
        content: newBlockContent,
      });
      await mutate("updateBlockContent", {
        block: entityID,
        content: oldBlockContent,
      });
      action.end();

      useUIState.setState(() => ({ focused: child }));
      document.getElementById(child)?.focus();
      setTimeout(() => {
        let el = document.getElementById(child) as
          | HTMLTextAreaElement
          | undefined;
        el?.setSelectionRange(0, 0);
      }, 10);
    },
  },
  {
    key: "J",
    ctrlKey: true,
    description: "Move block down",
    shiftKey: true,
    callback: async ({ mutate, entityID }) => {
      if (entityID) await mutate("moveBlockDown", { entityID });
    },
  },
  {
    key: "K",
    ctrlKey: true,
    description: "Move block up",
    shiftKey: true,
    callback: async ({ mutate, entityID }) => {
      if (entityID) await mutate("moveBlockUp", { entityID });
    },
  },
  {
    key: "H",
    ctrlKey: true,
    shiftKey: true,
    description: "Focus parent block",
    callback: async ({ rep, entityID, start, end }) => {
      if (!entityID) return;

      let root = useUIState.getState().root;
      let parent = await getParent(entityID, rep);
      if (root === entityID) {
        if (
          parent ===
          (await rep?.query((tx) => scanIndex(tx).aev("home")))?.[0]?.entity
        )
          useUIState.getState().setRoot(undefined);
        else {
          useUIState.getState().setRoot(parent);
          useUIState.getState().setFocused(parent);
        }
        keepFocus(entityID, start, end);
      }
      if (parent) document.getElementById(parent)?.focus();
    },
  },
];

async function getSuggestions(rep: Replicache | undefined) {
  let state = useAutocompleteState.getState();
  let suggestions: Fact<"block/unique-name">[] = [];
  if (state.suggestionPrefix) {
    suggestions = (
      (await rep?.query((tx) => scanIndex(tx).aev("block/unique-name"))) || []
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
}

async function getFirstChild(entityID: string, rep: Replicache | undefined) {
  if (!rep) return undefined;
  return (
    await rep.query((tx) => scanIndex(tx).vae(entityID, "block/parent"))
  ).sort(sortByPosition)[0]?.entity;
}
async function getAfter(
  entityID: string,
  rep: Replicache | undefined
): Promise<string | undefined> {
  if (!rep) return;
  let parent = await rep.query((tx) =>
    scanIndex(tx).eav(entityID, "block/parent")
  );
  if (!parent) return;
  let parentEntity = parent.value.value;
  let siblings = (
    await rep.query((tx) => scanIndex(tx).vae(parentEntity, "block/parent"))
  ).sort(sortByPosition);
  let index = siblings.findIndex((s) => s.entity === entityID);
  if (index === -1) return;
  if (index === siblings.length - 1) return getAfter(parentEntity, rep);
  return siblings[index + 1]?.entity;
}
async function getParent(entityID: string, rep: Replicache | undefined) {
  if (!rep) return;
  let parent = await rep.query((tx) =>
    scanIndex(tx).eav(entityID, "block/parent")
  );
  if (!parent) return;
  return parent.value.value;
}
async function getBefore(entityID: string, rep: Replicache | undefined) {
  if (!rep) return;
  let parent = await rep.query((tx) =>
    scanIndex(tx).eav(entityID, "block/parent")
  );
  if (!parent) return;
  let parentEntity = parent.value.value;
  let siblings = (
    await rep.query((tx) => scanIndex(tx).vae(parentEntity, "block/parent"))
  ).sort(sortByPosition);
  let index = siblings.findIndex((s) => s.entity === entityID);
  if (index === -1) return;
  return siblings[index - 1]?.entity;
}
function keepFocus(entityID: string, start: number, end: number) {
  document.getElementById(entityID)?.focus();
  setTimeout(() => {
    document
      .getElementById(entityID)
      //@ts-ignore
      ?.setSelectionRange?.(start, end);
  }, 50);
}
