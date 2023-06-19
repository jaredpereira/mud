import { BreadCrumbs } from "components/Breadcrumbs";
import { SpaceProvider } from "components/ReplicacheProvider";
import { db } from "hooks/useReplicache";
import { useUIState } from "hooks/useUIState";
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { decodeTime } from "src/ulid";

export default function StudioPage() {
  let { query } = useRouter();
  useEffect(() => {
    useUIState.persist.setOptions({ name: query.space as string });
    useUIState.persist.rehydrate();
  }, [query.space]);
  return (
    <>
      <Head>
        <link rel="manifest" href={`/api/manifest/${query.space}`} />
      </Head>
      {!query.space ? null : (
        <SpaceProvider id={query.space as string}>
          <List />
        </SpaceProvider>
      )}
    </>
  );
}

const List = () => {
  let blocks = db.useAttribute("block/content");
  return (
    <div className="flex flex-col-reverse gap-2">
      {blocks.map((block) => {
        let time = decodeTime(block.entity);
        let date = new Date(time);
        let lastUpdated = new Date(parseInt(block.lastUpdated));
        return (
          <div className="border p-2" key={block.id}>
            <div className="flex flex-row justify-between ">
              <div className="flex flex-row gap-1">
                {date.toLocaleString()}
                <div className="text-xs text-grey-55">
                  {lastUpdated.toLocaleString()}
                </div>
              </div>
              <BreadCrumbs entityID={block.entity} />
            </div>
            <div className="">{block.value}</div>
          </div>
        );
      })}
    </div>
  );
};
