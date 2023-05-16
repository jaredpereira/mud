import { Block, BlockContent } from "components/Block";
import { Header } from "components/Header";
import { SpaceProvider } from "components/ReplicacheProvider";
import { Toolbar } from "components/Toolbar";
import { db, useMutations } from "hooks/useReplicache";
import { useUIState } from "hooks/useUIState";
import Head from "next/head";
import { useRouter } from "next/router";

export default function StudioPage() {
  let { query } = useRouter();
  return (
    <>
      <Head>
        <link rel="manifest" href={`/api/manifest/${query.space}`} />
      </Head>
      {!query.space ? null : (
        <SpaceProvider id={query.space as string}>
          <Header />
          <Blocks />
          <Toolbar />
        </SpaceProvider>
      )}
    </>
  );
}

function Blocks() {
  let home = db.useAttribute("home")[0];
  let root = useUIState((s) => s.root);
  let rootBlocks = db
    .useReference(root || home?.entity, "block/parent")
    ?.sort((a, b) => {
      let aPosition = a.value.position,
        bPosition = b.value.position;
      if (aPosition === bPosition) return a.id > b.id ? 1 : -1;
      return aPosition > bPosition ? 1 : -1;
    });
  return (
    <div className="flex flex-col gap-3">
      {root && <RootBlock entityID={root} firstchild={rootBlocks[0]?.entity} />}
      {rootBlocks?.map((block, index) => (
        <Block
          parentFocused={false}
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

const RootBlock = (props: { entityID: string; firstchild?: string }) => {
  let parent = db.useEntity(props.entityID, "block/parent");

  return (
    parent && (
      <BlockContent
        firstChild={props.firstchild}
        entityID={props.entityID}
        factID={parent.id}
        parent={parent.value.value}
        depth={0}
        parentFocused={false}
        blurred={false}
      />
    )
  );
};
