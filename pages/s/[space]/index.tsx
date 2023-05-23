import { Block, BlockContent } from "components/Block";
import { Header } from "components/Header";
import { SpaceProvider } from "components/ReplicacheProvider";
import { Toolbar } from "components/Toolbar";
import { db } from "hooks/useReplicache";
import { useUIState } from "hooks/useUIState";
import Head from "next/head";
import { useRouter } from "next/router";
import { useSubscribe } from "hooks/useSubscribe";
import { scanIndex } from "src/replicache";
import { useEffect } from "react";
import { useKeyboardHandling } from "hooks/useKeyboardHandling";

export default function StudioPage() {
  let { query } = useRouter();
  useEffect(() => {
    useUIState.setState({ root: query.root as string });
  }, [query.root]);
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
  useKeyboardHandling();
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
      <>
        <BreadCrumbs entityID={props.entityID} />
        <BlockContent
          isRoot
          firstChild={props.firstchild}
          entityID={props.entityID}
          factID={parent.id}
          parent={parent.value.value}
          depth={0}
          parentFocused={false}
          blurred={false}
        />
      </>
    )
  );
};

const BreadCrumbs = (props: { entityID: string }) => {
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
