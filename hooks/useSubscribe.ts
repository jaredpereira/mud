import type { ReadonlyJSONValue, ReadTransaction } from "replicache";
import { useContext, useEffect, useState } from "react";
import { ReplicacheContext } from "components/ReplicacheProvider";

export function useSubscribe<R extends ReadonlyJSONValue>(
  query: (tx: ReadTransaction) => Promise<R>,
  def: R,
  deps: Array<unknown> = [],
  _key: string
): R {
  let rep = useContext(ReplicacheContext)?.rep;
  let [state, setState] = useState(def);
  useEffect(() => {
    if (!rep) {
      return;
    }

    let unsub = rep.subscribe(query, {
      onData: (data: R) => {
        setState(data);
      },
    });
    return () => {
      unsub();
      setState(def);
    };
  }, [rep, ...deps]);
  return state;
}
