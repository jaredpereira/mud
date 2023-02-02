export const BaseAttributes = {
  name: {
    unique: true,
    cardinality: "one",
    type: "string",
  },
  unique: {
    cardinality: "one",
    unique: false,
    type: "boolean",
  },
  type: {
    type: "union",
    unique: false,
    cardinality: "one",
    "union/value": [
      "file",
      "last-read-message",
      "timestamp",
      "string",
      "union",
      "position",
      "reference",
      "boolean",
      "flag",
      "number",
    ],
  },
  "union/value": {
    unique: false,
    type: "string",
    cardinality: "many",
  },
  cardinality: {
    unique: false,
    type: "union",
    cardinality: "one",
    "union/value": ["many", "one"],
  },
} as const;

export const DefaultAttributes = {
  arbitrarySectionReferenceType: {
    type: "reference",
    unique: false,
    cardinality: "many",
  },
  arbitrarySectionStringType: {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  "deck/contains": {
    type: "reference",
    unique: false,
    cardinality: "many",
  },
  "desktop/contains": {
    type: "reference",
    unique: false,
    cardinality: "many",
  },
  home: {
    type: "flag",
    unique: false,
    cardinality: "one",
  },
  "card/image": {
    type: "file",
    unique: false,
    cardinality: "one",
  },
  "card/date": {
    type: "timestamp",
    unique: false,
    cardinality: "one",
  },
  "card/content": {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  "card/scheduled": {
    type: "timestamp",
    unique: false,
    cardinality: "one",
  },
  "card/title": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "card/position-in": {
    type: "position",
    unique: false,
    cardinality: "one",
  },
  "card/created-by": {
    type: "reference",
    unique: false,
    cardinality: "one",
  },
  "card/unread-by": {
    type: "reference",
    unique: false,
    cardinality: "many",
  },
  "space/community": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/start-date": {
    type: "timestamp",
    unique: false,
    cardinality: "one",
  },
  "space/end-date": {
    type: "timestamp",
    unique: false,
    cardinality: "one",
  },
  ["space/studio"]: {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  ["space/id"]: {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/member": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/door/uploaded-image": {
    type: "file",
    unique: false,
    cardinality: "one",
  },
  "space/name": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/description": {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  "member/name": {
    unique: true,
    type: "string",
    cardinality: "one",
  },
  "this/name": {
    unique: true,
    type: "string",
    cardinality: "one",
  },
  "this/description": {
    unique: false,
    type: "string",
    cardinality: "one",
  },
  "canvas/height": {
    type: "number",
    cardinality: "one",
    unique: false,
  },
  "room/name": {
    type: "string",
    cardinality: "one",
    unique: false,
  },
} as const;

export const ShortCodes: { [k in keyof Attribute]?: string | undefined } = {
  "deck/contains": "cards",
};

export const AttributeFromShortCode = (a: string) => {
  return Object.entries(ShortCodes).find((f) => f[1] === a)?.[0] as
    | keyof Attribute
    | undefined;
};

export const Attribute = { ...DefaultAttributes, ...BaseAttributes };
export type Attribute = typeof Attribute;
export type UniqueAttributes = {
  [A in keyof Attribute as Attribute[A]["unique"] extends true
    ? A
    : never]: Attribute[A];
};

export type ReferenceAttributes = {
  [A in keyof Attribute as Attribute[A]["type"] extends "reference"
    ? A
    : never]: Attribute[A];
};

export type FilterAttributes<F extends Attribute[keyof Attribute]> = {
  [A in keyof Attribute as Attribute[A]["type"] extends F["type"]
    ? Attribute[A]["cardinality"] extends F["cardinality"]
      ? A
      : never
    : never]: Attribute[A];
};
