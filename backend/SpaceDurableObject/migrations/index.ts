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
export const migrations = [rootMigration].sort((a, b) => {
  return a.date > b.date ? 1 : -1;
});
