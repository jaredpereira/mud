const nullMigration = {
  date: "2023-03-22",
  run: async function (_storage: DurableObjectStorage, _ctx: { id: string }) {},
};
export const migrations = [nullMigration].sort((a, b) => {
  return a.date > b.date ? 1 : -1;
});
