import { Block } from "components/Block";
import { SpaceProvider } from "components/ReplicacheProvider";
import { db, useMutations } from "hooks/useReplicache";
import { useRouter } from "next/router";
import { ulid } from "src/ulid";

export default function StudioPage() {
  let { query } = useRouter();
  if (!query.space) return null;
  return (
    <SpaceProvider id={query.space as string}>
      <div className="flex flex-col gap-2">
        <Blocks />
      </div>
    </SpaceProvider>
  );
}

function Blocks() {
  let { mutate } = useMutations();
  let home = db.useAttribute("home")[0];
  let rootBlocks = db
    .useReference(home?.entity, "block/parent")
    ?.sort((a, b) => {
      let aPosition = a.value.position,
        bPosition = b.value.position;
      if (aPosition === bPosition) return a.id > b.id ? 1 : -1;
      return aPosition > bPosition ? 1 : -1;
    });
  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={() => {
          if (!home) return;
          mutate("addChildBlock", {
            factID: ulid(),
            parent: home.entity,
            child: ulid(),
            before: rootBlocks?.[0]?.entity || "",
          });
        }}
      >
        new
      </button>
      {rootBlocks?.map((block, index) => (
        <Block
          factID={block.id}
          before={rootBlocks?.[index - 1]?.entity}
          after={rootBlocks?.[index + 1]?.entity}
          key={block.entity}
          entityID={block.entity}
          parent={block.value.value}
        />
      ))}
    </div>
  );
}
