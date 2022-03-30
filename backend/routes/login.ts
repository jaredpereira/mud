import { z } from "zod";
import cookie from "cookie";
import { Bindings } from "backend";
import { Client } from "faunadb";
import bcrypt from "bcryptjs";
import { makePOSTRoute } from "backend/lib/api";
import { createSession } from "backend/fauna/resources/functions/create_new_session";
import { getIdentityByUsername } from "backend/fauna/resources/functions/get_identity_by_username";

const Errors = {
  noUser: "noUser",
  incorrectPassword: "incorrectPassword",
  insecureContext: "insecureContext",
} as const;

export const LoginRoute = makePOSTRoute({
  cmd: "login",
  input: z.object({
    username: z.string(),
    password: z.string(),
  }),
  handler: async (msg, env: Bindings, _request: Request) => {
    let fauna = new Client({
      secret: env.FAUNA_KEY,
      domain: "db.us.fauna.com",
    });
    let existingUser = await getIdentityByUsername(fauna, {
      username: msg.username.toLowerCase(),
    });
    if (!existingUser)
      return { data: { success: false, error: Errors.noUser } } as const;

    console.log(existingUser);
    let hashedPassword = await bcrypt.hash(msg.password, existingUser.salt);
    if (hashedPassword !== existingUser.hashedPassword)
      return {
        data: { success: false, error: Errors.incorrectPassword },
      } as const;
    let newToken = crypto.randomUUID?.();
    if (!newToken)
      return {
        data: { success: false, error: Errors.insecureContext },
      } as const;

    await createSession(fauna, {
      username: msg.username,
      userAgent: "",
      createdAt: Date.now().toString(),
      studio: existingUser.studio,
      id: newToken,
    });

    return {
      data: { success: true },
      headers: [
        [
          "Set-Cookie",
          cookie.serialize("auth", newToken, {
            path: "/",
            httpOnly: true,
            secure: true,
          }),
        ],
      ],
    } as const;
  },
});
