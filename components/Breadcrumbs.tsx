import { db } from "hooks/useReplicache";
import { useSubscribe } from "hooks/useSubscribe";
import { useUIState } from "hooks/useUIState";
import { scanIndex } from "src/replicache";

export const BreadCrumbs = (props: { entityID: string }) => {
  let path = useSubscribe(
    async (tx) => {
      let path = [];
      let current = props.entityID;
      while (current) {
        let parent = await scanIndex(tx).eav(current, "block/parent");
        if (!parent) break;
        path.push(parent.value.value);
        current = parent.value.value;
      }
      return path;
    },
    [],
    [props.entityID],
    props.entityID + "-path"
  );
  return (
    <div className="flex">
      <div className="no-scrollbar flex flex-row-reverse gap-0.5 overflow-x-scroll text-xs italic">
        {path.map((id, index) => (
          <>
            <Crumb entityID={id} key={id} />
            {index !== path.length - 1 && <span className="font-bold">/</span>}
          </>
        ))}

        <button
          className="hover:underline"
          onClick={() => useUIState.getState().setRoot(undefined)}
        >
          root
        </button>
      </div>
    </div>
  );
};

const Crumb = (props: { entityID: string }) => {
  let content = db.useEntity(props.entityID, "block/content");
  return (
    <button
      className="whitespace-nowrap hover:underline"
      onClick={() => useUIState.getState().setRoot(props.entityID)}
    >
      {content?.value.slice(0, 32)}
      {content && content.value.length > 32 && "..."}
    </button>
  );
};
