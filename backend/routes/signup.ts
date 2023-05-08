import { z } from "zod";
import { Bindings } from "backend";
import { makeRoute } from "backend/lib/api";

export const SignupRoute = makeRoute({
  route: "signup",
  input: z.object({}),
  handler: async (_msg, env: Bindings) => {
    let newSpaceID = env.SPACES.newUniqueId();
    return { data: { success: true, spaceID: newSpaceID.toString() } } as const;
  },
});
