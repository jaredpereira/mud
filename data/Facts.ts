import { Attribute } from "data/Attributes";
type AttributeName = keyof Attribute;

export type FactMetadata = {
  id: string;
  retracted?: boolean;
  lastUpdated: string;
  schema: Schema;
};

export type Schema = {
  type: Fact<"type">["value"];
  unique: Fact<"unique">["value"];
  cardinality: Fact<"cardinality">["value"];
};

export type Fact<A extends AttributeName> = FactMetadata & {
  attribute: A;
  entity: string;
  value: Value<A>;
};

type Value<A extends AttributeName> = Attribute[A] extends {
  type: "union";
}
  ? Attribute[A]["union/value"][number]
  : {
      union: never;
      timestamp: TimestampeType;
      string: string;
      number: number;
      boolean: boolean;
      parent: {
        type: "parent";
        value: string;
        position: string;
      };
      reference: ReferenceType;
      flag: {
        type: "flag";
      };
    }[Attribute[A]["type"]];

export type ReferenceType = { type: "reference"; value: string };
export type TimestampeType =
  | {
      type: "iso_string";
      value: string;
    }
  | {
      type: "yyyy-mm-dd";
      value: string;
    };

export const ref = (ref: string) => {
  return { type: "reference", value: ref } as const;
};

export const flag = () => {
  return { type: "flag" as const };
};

export const singleTextSection = (name: string) => {
  return `section/${name}` as "arbitrarySectionStringType";
};

export const multipleReferenceSection = (name: string) => {
  return `section/${name}` as "arbitrarySectionReferenceType";
};
