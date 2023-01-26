import { makeRoute, privateSpaceAPI } from "backend/lib/api";
import { flag } from "data/Facts";
import { ulid } from "src/ulid";
import { z } from "zod";
import { Env } from "..";
import { space_input } from "./create_space";
export const claimRoute = makeRoute({
  route: "claim",
  input: z.object({
    ownerID: z.string(),
    name: z.string(),
    ownerName: z.string(),
    data: space_input.merge(
      z.object({
        studio: z.string().optional(),
        community: z.string().optional(),
      })
    ),
  }),
  handler: async (msg, env: Env) => {
    let creator = await env.storage.get("meta-creator");
    let thisEntity = ulid();
    if (creator) return { data: { success: false } };
    let memberEntity = ulid();
    let homeEntity = ulid();
    await Promise.all([
      env.factStore.assertFact({
        entity: homeEntity,
        attribute: "home",
        value: flag(),
        positions: {},
      }),
      env.factStore.assertFact({
        entity: memberEntity,
        attribute: "space/member",
        value: msg.ownerID,
        positions: { aev: "a0" },
      }),
      env.factStore.assertFact({
        entity: memberEntity,
        attribute: "member/name",
        value: msg.ownerName,
        positions: { aev: "a0" },
      }),
      env.factStore.assertFact({
        entity: thisEntity,
        attribute: "this/name",
        positions: { aev: "a0" },
        value: msg.name,
      }),
      env.storage.put("meta-creator", msg.ownerID),
    ]);
    let selfStub = env.env.SPACES.get(env.env.SPACES.idFromString(env.id));
    await privateSpaceAPI(selfStub)("http://internal", "add_space_data", {
      entityID: thisEntity,
      spaceID: env.id,
      data: msg.data,
    });
    return { data: { success: true } };
  },
});
