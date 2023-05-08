import { spaceAPI } from "backend/lib/api";
import { z } from "zod";
import { pullRoute } from "backend/SpaceDurableObject/routes/pull";
import { createContext, useEffect, useRef, useState } from "react";
import {
  Puller,
  PullRequest,
  Pusher,
  PushRequest,
  Replicache,
} from "replicache";
import { UndoManager } from "@rocicorp/undo";
import {
  FactWithIndexes,
  makeMutators,
  MessageWithIndexes,
  ReplicacheMutators,
} from "src/replicache";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL as string;

export let ReplicacheContext = createContext<{
  rep: Replicache<ReplicacheMutators>;
  id: string;
  undoManager: UndoManager;
} | null>(null);
export const SpaceProvider: React.FC<
  React.PropsWithChildren<{ id: string }>
> = (props) => {
  let [rep, setRep] = useState<ReturnType<typeof makeReplicache>>();
  const [reconnectSocket, setReconnect] = useState({});
  let [undoManager] = useState(new UndoManager());

  useEffect(() => {
    let handler = (e: KeyboardEvent) => {
      if (
        (e.key === "z" && e.ctrlKey) ||
        (e.key === "z" && e.metaKey && !e.shiftKey)
      ) {
        undoManager.undo();
      }
      if (
        (e.key === "y" && e.ctrlKey) ||
        (e.key === "Z" && e.ctrlKey) ||
        (e.key === "z" && e.metaKey && e.shiftKey)
      ) {
        undoManager.redo();
      }
    };

    window.addEventListener("keydown", handler);

    return () => window.removeEventListener("keydown", handler);
  }, [undoManager]);
  let socket = useRef<WebSocket>();
  useEffect(() => {
    if (!props.id || !rep) return;
    socket.current = new WebSocket(`${SOCKET_URL}/space/${props.id}/socket`);
    socket.current.addEventListener("message", () => {
      rep?.pull();
    });
    return () => {
      socket.current?.close();
    };
  }, [props.id, rep, reconnectSocket]);
  useEffect(() => {
    let newRep = makeSpaceReplicache({
      id: props.id,
      undoManager: undoManager,
      onPull: () => {
        if (socket.current) {
          if (socket.current.readyState > 1) {
            setReconnect({});
          }
        }
      },
    });
    setRep(newRep);
    return () => {
      newRep.close();
    };
  }, [props.id, undoManager]);

  return (
    <ReplicacheContext.Provider
      value={rep ? { rep, id: props.id, undoManager } : null}
    >
      {props.children}
    </ReplicacheContext.Provider>
  );
};

export const makeSpaceReplicache = ({
  id,
  onPull,
  undoManager,
}: {
  id: string;
  onPull?: () => void;
  undoManager: UndoManager;
}) =>
  makeReplicache({
    name: `space-${id}-${WORKER_URL}`,
    pusher: async (request) => {
      let data: PushRequest = await request.json();
      await spaceAPI(`${WORKER_URL}/space/${id}`, "push", {
        ...data,
      });
      return { httpStatusCode: 200, errorMessage: "" };
    },
    puller: async (request) => {
      onPull?.();
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
      let messageOps = result.messages.map((m) => {
        return {
          op: "put",
          key: m.id,
          value: MessageWithIndexes(m),
        } as const;
      });
      return {
        httpRequestInfo: { httpStatusCode: 200, errorMessage: "" },
        response: {
          lastMutationID: result.lastMutationID,
          cookie: result.cookie,
          patch: [...ops, ...messageOps],
        },
      };
    },
    undoManager: undoManager,
  });

const makeReplicache = (args: {
  puller: Puller;
  pusher: Pusher;
  name: string;
  undoManager: UndoManager;
}) => {
  let grabData = function (): {
    rep: Replicache<ReplicacheMutators>;
    undoManager: UndoManager;
  } {
    return {
      undoManager: args.undoManager,
      rep: rep,
    };
  };

  // let [undoManager] = useState(new UndoManager());
  let rep = new Replicache({
    licenseKey: "l381074b8d5224dabaef869802421225a",
    schemaVersion: "1.0.1",
    name: args.name,
    pushDelay: 500,
    pusher: args.pusher,
    puller: args.puller,
    mutators: makeMutators(grabData),
    logLevel: "error",
    indexes: {
      eav: { jsonPointer: "/indexes/eav", allowEmpty: true },
      aev: { jsonPointer: "/indexes/aev", allowEmpty: true },
      ave: { jsonPointer: "/indexes/ave", allowEmpty: true },
      vae: { jsonPointer: "/indexes/vae", allowEmpty: true },
      at: { jsonPointer: "/indexes/at", allowEmpty: true },
      messages: { jsonPointer: "/indexes/messages", allowEmpty: true },
    },
  });

  return rep;
};
