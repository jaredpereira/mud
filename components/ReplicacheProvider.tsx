import { spaceAPI } from "backend/lib/api";
import { z } from "zod";
import { pullRoute } from "backend/SpaceDurableObject/routes/pull";
import {
  FactWithIndexes,
  makeReplicache,
  ReplicacheContext,
} from "hooks/useReplicache";
import { useEffect, useState } from "react";
import { PullRequest, PushRequest } from "replicache";
import { useAuth } from "hooks/useAuth";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
export const SpaceProvider: React.FC<{ id: string }> = (props) => {
  let [rep, setRep] = useState<ReturnType<typeof makeReplicache>>();
  let { session } = useAuth();
  useEffect(() => {
    let rep = makeSpaceReplicache({
      id: props.id,
      session: session.session?.studio,
      token: session.token,
    });
    setRep(rep);
    return () => {
      rep.close();
    };
  }, [props.id, session.token, session.session?.studio]);
  return (
    <ReplicacheContext.Provider value={rep ? { rep, id: props.id } : null}>
      {props.children}
    </ReplicacheContext.Provider>
  );
};

export const makeSpaceReplicache = ({
  id,
  session,
  token,
}: {
  id: string;
  session?: string;
  token?: string;
}) =>
  makeReplicache({
    name: `space-${id}-${session}`,
    pusher: async (request) => {
      let data: PushRequest = await request.json();
      if (!token)
        return { httpStatusCode: 200, errorMessage: "no user logged in" };
      await spaceAPI(`${WORKER_URL}/space/${id}`, "push", {
        ...data,
        token: token,
      });
      return { httpStatusCode: 200, errorMessage: "" };
    },
    puller: async (request) => {
      let data: PullRequest = await request.json();
      let result = await spaceAPI(
        `${WORKER_URL}/space/${id}`,
        "pull",
        data as z.infer<typeof pullRoute.input>
      );
      let ops = result.data.map((fact) => {
        if (fact.retracted)
          return {
            op: "del",
            key: fact.id,
          } as const;
        return {
          op: "put",
          key: fact.id,
          value: FactWithIndexes(fact),
        } as const;
      });
      return {
        httpRequestInfo: { httpStatusCode: 200, errorMessage: "" },
        response: {
          lastMutationID: result.lastMutationID,
          cookie: result.cookie,
          patch: ops,
        },
      };
    },
  });