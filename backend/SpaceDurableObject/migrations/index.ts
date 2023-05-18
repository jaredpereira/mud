import { store } from "backend/SpaceDurableObject/fact_store";
import { ulid } from "src/ulid";
const rootMigration = {
  date: "2023-03-22",
  run: async function (storage: DurableObjectStorage, ctx: { id: string }) {
    let fact_store = store(storage, ctx);
    await fact_store.assertFact({
      entity: ulid(),
      attribute: "home",
      value: { type: "flag" },
    });
  },
};

const linksMigration = {
  date: "2023-05-17",
  run: async function (storage: DurableObjectStorage, ctx: { id: string }) {
    let fact_store = store(storage, ctx);
    let contentFacts = await fact_store.scanIndex.aev("block/content");
    for (let fact of contentFacts) {
      if (fact.value.startsWith("#")) {
        let title = fact.value
          .split("\n")[0]
          .slice(1)
          .replace(/^#+/, "")
          .trim();
        console.log(title);
        await fact_store.assertFact({
          entity: fact.entity,
          attribute: "block/unique-name",
          value: title,
        });
      }
    }
  },
};
export const migrations = [rootMigration, linksMigration].sort((a, b) => {
  return a.date > b.date ? 1 : -1;
});
