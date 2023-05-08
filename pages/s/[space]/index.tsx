import { SpaceProvider } from "components/ReplicacheProvider";
import { Textarea } from "components/Textarea";
import { db, useMutations } from "hooks/useReplicache";
import { useRouter } from "next/router";
import { useState } from "react";
import { ulid } from "src/ulid";

export default function StudioPage() {
  let { query } = useRouter();

  return (
    <SpaceProvider id={query.space as string}>
      <div className="flex flex-col gap-2">
        <FirstBlock />
        <Blocks />
      </div>
    </SpaceProvider>
  );
}

function Blocks() {
  let rootBlocks = db.useAttribute("space/root-block");

  return (
    <div>
      {rootBlocks.map((block) => (
        <Block key={block.id} entityID={block.entity} />
      ))}
    </div>
  );
}

function FirstBlock() {
  let { mutate } = useMutations();
  let [value, setValue] = useState("Hello!");
  return (
    <div className="grid">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        className={`h-full w-full bg-inherit`}
        onKeyDown={async (e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            let entity = ulid();
            await mutate("assertFact", [
              {
                entity,
                attribute: "space/root-block",
                value: "a0",
              },
              {
                entity,
                attribute: "block/content",
                value: e.currentTarget.value,
              },
            ]);
          }
        }}
      />
    </div>
  );
}

function Block(props: { entityID: string }) {
  let content = db.useEntity(props.entityID, "block/content");
  return <div className="border p-2">{content?.value}</div>;
}
