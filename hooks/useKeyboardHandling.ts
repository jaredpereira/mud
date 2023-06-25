import { useAutocompleteState } from "components/Autocomplete";
import { ReplicacheContext } from "components/ReplicacheProvider";
import { Fact } from "data/Facts";
import { useContext, useEffect } from "react";
import { Replicache } from "replicache";
import { generateKeyBetween } from "src/fractional-indexing";
import { scanIndex } from "src/replicache";
import { ulid } from "src/ulid";
import {
  getLinkAtCursor,
  modifyString,
  sortByPosition,
  Transaction,
} from "src/utils";
import { useMutations } from "./useReplicache";
import { getLastOpenChild, openBlock, useUIState } from "./useUIState";

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
        offset: [number, number] = [0, 0],
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
                  cursors[0] + offset[0],
                  cursors[1] + offset[1]
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
            cursors[0] + offset[0],
            cursors[1] + offset[1]
          );
        }, 10);
        if (undo) action.end();
      };
      for (let shortcut of shortcuts) {
        if (
          shortcut.key === e.key &&
          !!shortcut.ctrlKey === (!!e.ctrlKey || !!e.metaKey) &&
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

        case "Backspace": {
          if (!entityID) return;
          if (
            value[start - 1] === "*" &&
            value[start] === "*" &&
            start === end
          ) {
            e.preventDefault();
            transact(
              (text) => {
                text.delete(start - 1, 2);
              },
              [-1, -1]
            );
            break;
          }
          if (
            value[start - 1] === "[" &&
            value[start] === "]" &&
            start === end
          ) {
            e.preventDefault();
            transact(
              (text) => {
                text.delete(start - 1, 2);
              },
              [-1, -1]
            );
            break;
          }

          if (
            value[start - 2] === "[" &&
            value[start - 1] === "]" &&
            start === end
          ) {
            e.preventDefault();
            transact(
              (text) => {
                text.delete(start - 2, 2);
              },
              [-2, -2]
            );
            break;
          }
          if (start === 0 && end === 0) {
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

            let id: string;
            let previousSibling = await getBefore(entityID, rep);
            if (previousSibling) {
              let p = previousSibling;
              id = await rep.query((tx) => getLastOpenChild(tx, p));
            } else {
              let parent = await getParent(entityID, rep);
              if (!parent) {
                return await mutate("deleteBlock", { entity: entityID });
              }
              id = parent;
            }

            e.preventDefault();
            let content = await rep.query((tx) =>
              scanIndex(tx).eav(id, "block/content")
            );
            if (content) {
              let len = content.value.length;
              await mutate("updateBlockContent", {
                block: id,
                content: content.value + value,
              });
              setTimeout(() => {
                let el = document.getElementById(id) as
                  | HTMLTextAreaElement
                  | undefined;
                el?.setSelectionRange?.(len, len);
              }, 10);
            }
            await mutate("deleteBlock", { entity: entityID });

            document.getElementById(id)?.focus();
            action.end();
          }

          break;
        }
        case "i": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          transact(
            (text) => {
              text.insert(start, "*");
              text.insert(end + 1, "*");
            },
            [0, 1],
            true
          );
          break;
        }
        case "b": {
          if (!e.ctrlKey) break;
          e.preventDefault();
          transact(
            (text) => {
              text.insert(start, "**");
              text.insert(end + 2, "**");
            },
            [0, 2],
            true
          );
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
              transact(
                (text) => {
                  text.insert(start, "**");
                },
                [1, 1]
              );
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
            transact(
              (text) => {
                text.insert(start, "[]");
              },
              [1, 1]
            );
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

export const shortcuts: {
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
        offset: [number, number],
        undo?: boolean
      ) => void;
    } & ReturnType<typeof useMutations>
  ) => void;
}[] = [
  {
    key: ":",
    ctrlKey: true,
    shiftKey: true,
    description: "Zoom into current block",
    callback: ({ entityID, start, end }) => {
      if (!entityID) return;
      useUIState.getState().setRoot(entityID);
      keepFocus(entityID, start, end);
    },
  },
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
      useUIState.setState((s) => ({
        openStates: { ...s.openStates, [entityID]: true },
      }));
      await mutate("outdentBlock", { factID: ulid(), entityID });
    },
  },
  {
    key: "G",
    description: "focus the last block",
    ctrlKey: true,
    shiftKey: true,
    callback: async ({ rep }) => {
      let root = useUIState.getState().root;
      if (!root) {
        let home = await rep?.query((tx) => scanIndex(tx).aev("home"));
        if (!home?.[0]) return;
        root = home[0].entity;
      }
      let r = root;
      let children =
        (await rep?.query((tx) => scanIndex(tx).vae(r, "block/parent"))) || [];
      let last = children.sort(sortByPosition)[children.length - 1];
      if (last) {
        document.getElementById(last.entity)?.scrollIntoView();
        useUIState.setState({ focused: last.entity });
      }
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
    key: " ",
    description: "Expand or collapse children",
    ctrlKey: true,
    callback: ({ entityID }) => {
      console.log("yo");
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
    description: "Add a sibling block",
    ctrlKey: true,
    callback: async ({ entityID, mutate, rep }) => {
      if (!entityID) return;
      let child = ulid();

      let parent = await getParent(entityID, rep);
      if (!parent) return;
      await mutate("addChildBlock", {
        factID: ulid(),
        parent: parent,
        child,
        after: entityID,
      });
      useUIState.setState(() => ({ focused: child }));
      document.getElementById(child)?.focus();
    },
  },
  {
    key: "Enter",
    description: "create new child block",
    ctrlKey: true,
    shiftKey: true,
    callback: async ({ mutate, entityID }) => {
      if (!entityID) return;
      let child = ulid();
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
    description: "Create a new sibling block, splitting the current block",
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
          [2 - s.suggestionPrefix.length, 2 - s.setSuggestionPrefix.length],
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
    key: "j",
    ctrlKey: true,
    description: "Focus next block",
    callback: async ({ rep, entityID }) => {
      if (!rep) return;
      let s = await getSuggestions(rep);
      if (s.suggestions.length > 0) {
        if (s.suggestionIndex < s.suggestions.length - 1)
          s.setSuggestionIndex((i) => i + 1);
        return;
      }
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
      let entity: string | undefined;
      if (
        firstChild &&
        (useUIState.getState().openStates[entityID] ||
          useUIState.getState().root === entityID)
      )
        entity = firstChild;
      else {
        let after = await getAfter(entityID, rep);
        entity = after;
      }
      if (entity) {
        document.getElementById(entity)?.focus();

        requestAnimationFrame(() => {
          if (!entity) return;
          let el = document.getElementById(entity) as
            | HTMLTextAreaElement
            | undefined;
          el?.setSelectionRange(el.value.length, el.value.length);
        });
      }
    },
  },
  {
    key: "k",
    ctrlKey: true,
    description: "focus previous block",
    callback: async ({ rep, entityID }) => {
      if (!rep) return;
      let s = await getSuggestions(rep);
      if (s.suggestions.length > 0) {
        if (s.suggestionIndex > 0) s.setSuggestionIndex((i) => i - 1);
        return;
      }

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
      let entity: string | undefined;
      let previousSibling = await getBefore(entityID, rep);
      if (previousSibling) {
        let p = previousSibling;
        if (!rep) return;
        entity = await rep.query((tx) => getLastOpenChild(tx, p));
      } else {
        entity = await getParent(entityID, rep);
      }

      if (entity) {
        document.getElementById(entity)?.focus();

        requestAnimationFrame(() => {
          if (!entity) return;
          let el = document.getElementById(entity) as
            | HTMLTextAreaElement
            | undefined;
          el?.setSelectionRange(el.value.length, el.value.length);
        });
      }
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
  {
    key: "o",
    ctrlKey: true,
    description: "Open link at point",
    callback: async ({ rep, start, value }) => {
      let link = getLinkAtCursor(value, start);
      if (!link) return;
      let l = link.value;
      if (!rep) return;
      let block = await rep.query((tx) =>
        scanIndex(tx).ave("block/unique-name", l)
      );
      if (block) openBlock(block?.entity, rep);
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
