import { beforeAll, test, expect } from "@jest/globals";
import { store } from "backend/SpaceDurableObject/fact_store";
import { Fact } from "data/Facts";
import { ulid } from "src/ulid";
const { SPACES } = getMiniflareBindings();
const id = SPACES.newUniqueId();
const stub = SPACES.get(id);

beforeAll(async () => {
  // Gotta initialize the DO
  await stub.fetch("http://localhost/poke");
});

test("retracting a fact marks it as retracted", async () => {
  const storage = await getMiniflareDurableObjectStorage(id);
  let fact_store = store(storage, { id: "" });
  let entity = ulid();
  await fact_store.assertFact({
    entity,
    attribute: "space/studio",
    value: "Title",
  });
  let fact = await fact_store.scanIndex.eav(entity, "space/studio");
  expect(fact?.value).toBe("Title");
  if (!fact) throw new Error();
  await fact_store.retractFact(fact.id);
  let retractedFact = await fact_store.scanIndex.eav(entity, "space/studio");
  expect(retractedFact).toBeFalsy();
});

test("single cardinality asserts should only create one fact even with multiple competing asserts", async () => {
  const storage = await getMiniflareDurableObjectStorage(id);
  let fact_store = store(storage, { id: "" });

  let entity = ulid();
  await Promise.all(
    ["value 1", "value 2", "value 3"].map((value) =>
      fact_store.assertFact({
        entity,
        attribute: "block/content",
        value,
      })
    )
  );
  let newFacts = [
    ...(await storage.list<Fact<any>>({
      prefix: "ti-",
      startAfter: `ti-`,
    })),
  ];
  expect(newFacts.length).toEqual(2);
});

test("you can't assert a fact with an unknown attribute", async () => {
  const storage = await getMiniflareDurableObjectStorage(id);
  let fact_store = store(storage, { id: "" });

  let entity = ulid();
  let result = await fact_store.assertFact({
    entity,
    attribute: "unknown attr" as "block/content",
    value: "nada",
  });
  expect(result.success).toBe(false);
  let newFacts = [
    ...(await storage.list<Fact<any>>({
      prefix: "ti-",
      startAfter: `ti-`,
    })),
  ];
  expect(newFacts.length).toEqual(1);
});

test("You can't create multiple facts with the same value of a unique attribute", async () => {
  const storage = await getMiniflareDurableObjectStorage(id);
  let fact_store = store(storage, { id: "" });
  let uniqueValue = "a unique value";

  let originalEntity = ulid();
  await fact_store.assertFact({
    entity: originalEntity,
    attribute: "space/studio",
    value: uniqueValue,
  });

  expect(
    (await fact_store.scanIndex.ave("space/studio", uniqueValue))?.entity
  ).toBe(originalEntity);

  let result = await fact_store.assertFact({
    entity: ulid(),
    attribute: "space/studio",
    value: uniqueValue,
  });
  expect(result.success).toBe(false);
  expect(
    (await fact_store.scanIndex.ave("space/studio", uniqueValue))?.entity
  ).toBe(originalEntity);
});
