import m2022_07_18 from "./2022-07-18";
import m2022_07_19 from "./2022-07-19";

export const latestMigration = "2022-07-19";
export const migrations = [m2022_07_18, m2022_07_19].sort((a, b) => {
  return a.date > b.date ? 1 : -1;
});
