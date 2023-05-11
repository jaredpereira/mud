import { Block } from "components/Block";
import { SpaceProvider } from "components/ReplicacheProvider";
import { db, useMutations } from "hooks/useReplicache";
import Head from "next/head";
import { useRouter } from "next/router";
import { ulid } from "src/ulid";

export default function StudioPage() {
  let { query } = useRouter();
  return (
    <>
      <Head>
        <link rel="manifest" href={`/api/manifest/${query.space}`} />
      </Head>
      {!query.space ? null : (
        <SpaceProvider id={query.space as string}>
          <Blocks />
        </SpaceProvider>
      )}
    </>
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
    <div className="flex flex-col gap-3">
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
          depth={1}
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
