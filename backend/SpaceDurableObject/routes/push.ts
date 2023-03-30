import { z } from "zod";
import { makeRoute } from "backend/lib/api";
import { Env } from "..";
import { Mutations } from "data/mutations";
import { store } from "../fact_store";
import { CachedStorage } from "../storage_cache";
import { app_event } from "backend/lib/analytics";
import { authTokenVerifier, verifyIdentity } from "backend/lib/auth";

export const push_route = makeRoute({
  route: "push",
  input: z.object({
    authToken: authTokenVerifier,
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

    let session = await verifyIdentity(env.env, msg.authToken);
    if (!session)
      return {
        data: { success: false, error: "Invalid session token" },
      } as const;
    let cachedStore = new CachedStorage(env.storage);
    let fact_store = store(cachedStore, { id: env.id });

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

    let release = await env.pushLock.lock();

    for (let i = 0; i < msg.mutations.length; i++) {
      let mutation = msg.mutations[i];
      if (mutation.id <= lastMutationID) continue;
      lastMutationID = mutation.id;
      let name = mutation.name as keyof typeof Mutations;
      if (name === "createCard") {
        app_event(env.env, {
          event: "created_card",
          spaceID: env.id,
          user: session.username,
        });
      }
      if (!Mutations[name]) {
        continue;
      }
      try {
        await Mutations[name](mutation.args, {
          ...fact_store,
          runOnServer: (fn) => fn({ ...env, factStore: fact_store }),
        });
      } catch (e) {
        console.log(
          `Error occured while running mutation: ${name}`,
          JSON.stringify(e)
        );
      }
    }
    cachedStore.put<number>(`lastMutationID-${msg.clientID}`, lastMutationID);
    await cachedStore.flush();
    release();
    app_event(env.env, {
      event: "pushed_to_space",
      spaceID: env.id,
      user: session.username,
    });

    env.poke();
    return { data: { success: true, errors: [] } };
  },
});
