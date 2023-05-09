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
      "parent",
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
  "block/content": {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  "space/root-block": {
    type: "string",
    unique: false,
    cardinality: "one",
  },
  "block/parent": {
    type: "parent",
    unique: false,
    cardinality: "one",
  },
  "block/inline-link": {
    type: "reference",
    unique: false,
    cardinality: "one",
  },
  home: {
    type: "flag",
    unique: false,
    cardinality: "one",
  },
  "space/studio": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/id": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
  "space/member": {
    type: "string",
    unique: true,
    cardinality: "many",
  },
  "member/name": {
    type: "string",
    unique: true,
    cardinality: "one",
  },
} as const;

export const Attribute = { ...DefaultAttributes, ...BaseAttributes };
export type Attribute = typeof Attribute;
export type UniqueAttributes = {
  [A in keyof Attribute as Attribute[A]["unique"] extends true
    ? A
    : never]: Attribute[A];
};

export type ReferenceAttributes = {
  [A in keyof Attribute as Attribute[A]["type"] extends "reference" | "parent"
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
