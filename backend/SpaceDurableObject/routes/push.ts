import { z } from "zod";
import { makeRoute } from "backend/lib/api";
import { Env } from "..";
import { Client } from "faunadb";
import { getSessionById } from "backend/fauna/resources/functions/get_session_by_id";
import { Mutations } from "data/mutations";

export const push_route = makeRoute({
  route: "push",
  input: z.object({
    token: z.string(),
    clientID: z.string(),
    mutations: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        args: z.any(),
        timestamp: z.number(),
      })
    ),
    pushVersion: z.number(),
    schemaVersion: z.string(),
  }),
  handler: async (msg, env: Env) => {
    let lastMutationID =
      (await env.storage.get<number>(`lastMutationID-${msg.clientID}`)) || 0;
    let fauna = new Client({
      secret: env.env.FAUNA_KEY,
      domain: "db.us.fauna.com",
    });

    let session = await getSessionById(fauna, { id: msg.token });
    if (!session)
      return {
        data: { success: false, error: "Invalid session token" },
      } as const;

    let isMember = await env.factStore.scanIndex.ave(
      "space/member",
      session.studio
    );
    if (!isMember) {
      env.storage.put<number>(
        `lastMutationID-${msg.clientID}`,
        msg.mutations[msg.mutations.length - 1].id
      );
      return {
        data: { success: false, error: "user is not a member" },
      } as const;
    }

    for (let i = 0; i < msg.mutations.length; i++) {
      let mutation = msg.mutations[i];
      lastMutationID = mutation.id;
      let name = mutation.name as keyof typeof Mutations;
      if (!Mutations[name]) {
        continue;
      }
      try {
        await Mutations[name](mutation.args, env.factStore);
      } catch (e) {
        console.log(
          `Error occured while running mutation: ${name}`,
          JSON.stringify(e)
        );
      }
    }
    env.storage.put<number>(`lastMutationID-${msg.clientID}`, lastMutationID);

    return { data: { success: true, errors: [] } };
  },
});