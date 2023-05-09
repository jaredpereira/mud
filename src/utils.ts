import { ReadTransaction } from "replicache";
import { scanIndex } from "./replicache";

export const getCurrentDate = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}-${("0" + month).slice(-2)}-${("0" + day).slice(-2)}`;
};

export const slugify = (str: string) => {
  var specials =
    /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~’]/g;
  return str.trim().replace(specials, "").replace(/\s/g, "-").toLowerCase();
};

export function getLinkAtCursor(text: string, cursor: number) {
  let start: number | undefined;
  let end: number | undefined;
  for (let i = 0; i < 140; i++) {
    let startPosition = cursor - i;
    if (!start && text.slice(startPosition - 2, startPosition) === "[[")
      start = startPosition;
    if (!end && text.slice(cursor + i, cursor + i + 2) === "]]")
      end = cursor + i;
  }
  if (!start || start < 0 || !end) return undefined;
  return {
    value: text.slice(start, end),
    start,
    end,
  };
}

export function sortByPosition(
  a: { value: { position: string }; id: string },
  b: { value: { position: string }; id: string }
) {
  let aPosition = a.value.position,
    bPosition = b.value.position;
  if (aPosition === bPosition) return a.id > b.id ? 1 : -1;
  return aPosition > bPosition ? 1 : -1;
}

export async function getLastChild(
  tx: ReadTransaction,
  parent: string
): Promise<string> {
  let children = (await scanIndex(tx).vae(parent, "block/parent")).sort(
    sortByPosition
  );
  if (children.length === 0) return parent;
  return getLastChild(tx, children[children.length - 1].entity);
}
