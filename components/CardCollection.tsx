import { Fact } from "data/Facts";
import { useCardPreviewData } from "hooks/CardPreviewData";
import { useAuth } from "hooks/useAuth";
import {
  ReplicacheContext,
  scanIndex,
  useIndex,
  useMutations,
  useSpaceID,
} from "hooks/useReplicache";
import { useSubscribe } from "hooks/useSubscribe";
import { useContext, useState } from "react";
import { generateKeyBetween } from "src/fractional-indexing";
import { getAndUploadFile } from "src/getAndUploadFile";
import { sortByPosition, updatePositions } from "src/position_helpers";
import { ulid } from "src/ulid";
import { CardPreview } from "./CardPreview";
import { CardAdder } from "./CardStack";
import { useCardViewer } from "./CardViewerContext";
import { useCombinedRefs } from "./Desktop";
import { useDraggableCard, useDroppableZone } from "./DragContext";
import {
  CollectionList as CollectionListIcon,
  CollectionPreview as CollectionPreviewIcon,
} from "./Icons";

export const CardCollection = (props: {
  entityID: string;
  attribute: "desktop/contains" | "deck/contains";
}) => {
  let [filter, setFilter] = useState<null | { reaction: string; not: boolean }>(
    null
  );
  let cards = useCards(props.entityID, props.attribute);
  let reactions = cards.reduce((acc, card) => {
    for (let reaction of card.reactions) {
      if (!acc.includes(reaction)) acc.push(reaction);
    }
    return acc;
  }, [] as string[]);
  let collectionType = useIndex.eav(props.entityID, "collection/type");
  return (
    <>
      <CollectionHeader entityID={props.entityID} />
      <FilterByReactions
        reactions={reactions}
        filter={filter}
        setFilter={setFilter}
      />
      <CollectionList
        attribute={props.attribute}
        entityID={props.entityID}
        cards={cards.filter((card) =>
          !filter
            ? true
            : filter.not
            ? !card.reactions.includes(filter.reaction)
            : card.reactions.includes(filter.reaction)
        )}
        size={collectionType?.value === "cardpreview" ? "big" : "small"}
      />
    </>
  );
};

function FilterByReactions(props: {
  reactions: string[];
  filter: { reaction: string; not: boolean } | null;
  setFilter: (f: { reaction: string; not: boolean } | null) => void;
}) {
  return (
    <div className="no-scrollbar flex flex-row  gap-2 overflow-x-scroll">
      {props.reactions.map((reaction) => {
        return (
          <button
            key={reaction}
            onClick={() => {
              if (props.filter?.reaction === reaction) {
                if (props.filter.not) props.setFilter(null);
                else props.setFilter({ reaction, not: true });
              } else props.setFilter({ reaction, not: false });
            }}
            className={`text-md flex items-center gap-2 rounded-md border px-2 py-0.5 ${
              props.filter?.reaction === reaction
                ? "border-accent-blue bg-bg-blue"
                : "border-grey-80"
            }`}
          >
            <strong>
              {props.filter?.reaction === reaction &&
                (props.filter.not ? "-" : "+")}{" "}
              {reaction}
            </strong>{" "}
          </button>
        );
      })}
    </div>
  );
}

const useCards = (
  entityID: string,
  attribute: "desktop/contains" | "deck/contains"
) => {
  let cards = useSubscribe(
    async (tx) => {
      let allCards = await scanIndex(tx).eav(entityID, attribute);
      return Promise.all(
        allCards.sort(sortByPosition("eav")).map(async (card) => {
          let reactions = (
            await scanIndex(tx).eav(card.value.value, "card/reaction")
          ).map((r) => r.value);
          return { ...card, reactions };
        })
      );
    },
    [],
    [entityID, attribute],
    `${entityID}-cards`
  );
  return cards;
};

const CollectionList = (props: {
  size: "small" | "big";
  entityID: string;
  attribute: "desktop/contains" | "deck/contains";
  cards: Fact<"desktop/contains" | "deck/contains">[];
}) => {
  let rep = useContext(ReplicacheContext);
  let spaceID = useSpaceID();
  let { authToken } = useAuth();
  let { mutate, action } = useMutations();
  let { setNodeRef, over } = useDroppableZone({
    type: "dropzone",
    entityID: "",
    id: "add-card-dropzone",
    onDragEnd: async (data) => {
      if (!rep) return;
      if (data.type !== "card") return;
      action.start();

      let siblings = (
        await rep.rep.query((tx) => {
          return scanIndex(tx).eav(props.entityID, props.attribute);
        })
      ).sort(sortByPosition("eav"));

      let newIndex = siblings.length - 1;
      if (data.parent !== props.entityID) {
        let position = generateKeyBetween(
          siblings[newIndex]?.positions.eav || null,
          siblings[newIndex + 1]?.positions.eav || null
        );

        await mutate("retractFact", { id: data.id });
        await mutate("addCardToSection", {
          factID: ulid(),
          cardEntity: data.entityID,
          parent: props.entityID,
          section: props.attribute,
          positions: {
            eav: position,
          },
        });
      } else {
        let currentIndex = siblings.findIndex(
          (f) => f.value.value === data.entityID
        );
        let newPositions = updatePositions("eav", siblings, [
          [siblings[currentIndex].id, newIndex],
        ]);
        mutate("updatePositions", {
          positionKey: "eav",
          newPositions,
        });
      }
      action.end();
    },
  });
  return (
    <div
      ref={setNodeRef}
      className="collectionCardList z-10 flex h-full flex-col"
      onDragOver={(e) => e.preventDefault()}
      onDrop={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!rep || !authToken || !spaceID) return;
        let data = await getAndUploadFile(
          e.dataTransfer.items,
          authToken,
          spaceID
        );
        if (!data.success) return;

        let entity = ulid();
        await mutate("assertFact", {
          entity,
          factID: ulid(),
          attribute: "card/image",
          value: { type: "file", id: data.data.id, filetype: "image" },
          positions: {},
        });

        let siblings =
          (await rep.rep.query((tx) => {
            return scanIndex(tx).eav(props.entityID, props.attribute);
          })) || [];

        let lastPosition = siblings.sort(sortByPosition("eav"))[
          siblings.length - 1
        ]?.positions["eav"];
        let position = generateKeyBetween(lastPosition || null, null);
        await mutate("addCardToSection", {
          factID: ulid(),
          cardEntity: entity,
          parent: props.entityID,
          section: props.attribute,
          positions: {
            eav: position,
          },
        });
      }}
    >
      {props.cards.length > 5 && (
        <div className="pb-2">
          <CardAdder
            parentID={props.entityID}
            attribute={props.attribute}
            positionKey="eav"
            openOnAdd
          />
        </div>
      )}
      {props.cards?.map((card) => (
        <DraggableCard
          attribute={props.attribute}
          hideContent={props.size === "small"}
          parent={props.entityID}
          entityID={card.value.value}
          key={card.id}
          id={card.id}
        />
      ))}

      {over && over.type === "card" && (
        <div className="opacity-60">
          <CardPreview
            data={over.data}
            entityID={over.entityID}
            size={"big"}
            hideContent={props.size === "small"}
          />
        </div>
      )}
      <CardAdder
        parentID={props.entityID}
        attribute={props.attribute}
        positionKey="eav"
        addToEnd
        openOnAdd
      />
    </div>
  );
};

const CollectionHeader = (props: { entityID: string }) => {
  let collectionType = useIndex.eav(props.entityID, "collection/type");
  let { mutate, authorized } = useMutations();
  if (!authorized) return null;
  let type = collectionType?.value || "grid";

  const onClick = (value: Fact<"collection/type">["value"]) => () => {
    mutate("assertFact", {
      entity: props.entityID,
      attribute: "collection/type",
      value: value,
      positions: {},
    });
  };
  const className = (typeName: Fact<"collection/type">["value"]) =>
    `p-0.5 text-grey-55 ${
      type === typeName
        ? "rounded-md border border-grey-55"
        : "border border-transparent"
    }`;

  return (
    <div className="collectionTypeSelector flex flex-row gap-0.5 place-self-end">
      <button
        className={`${className("list")} shrink-0`}
        onClick={onClick("list")}
      >
        <CollectionListIcon />
      </button>
      <button
        className={`${className("cardpreview")} shrink-0`}
        onClick={onClick("cardpreview")}
      >
        <CollectionPreviewIcon />
      </button>
    </div>
  );
};

// I need to extract this to be used on the desktop as well
// I also need to extract out the useDraggable and useDroppable hooks with
// specific types

const DraggableCard = (props: {
  entityID: string;
  attribute: "desktop/contains" | "deck/contains";
  hideContent?: boolean;
  id: string;
  parent: string;
}) => {
  let data = useCardPreviewData(props.entityID);
  const { attributes, listeners, setNodeRef, isDragging, isOverSomethingElse } =
    useDraggableCard({
      data: data,
      type: "card",
      id: props.id,
      parent: props.parent,
      entityID: props.entityID,
      hideContent: !!props.hideContent,
      size: "big",
    });

  let rep = useContext(ReplicacheContext);
  let { mutate, action } = useMutations();
  let { setNodeRef: draggableRef, over } = useDroppableZone({
    type: "card",
    entityID: props.entityID,
    id: props.id,
    onDragEnd: async (data) => {
      if (!rep) return;
      if (data.type !== "card") return;
      action.start();

      let siblings = (
        await rep.rep.query((tx) => {
          return scanIndex(tx).eav(props.parent, props.attribute);
        })
      ).sort(sortByPosition("eav"));

      let newIndex = siblings.findIndex(
        (f) => f.value.value === props.entityID
      );
      if (data.parent !== props.parent) {
        let position = generateKeyBetween(
          siblings[newIndex - 1]?.positions.eav || null,
          siblings[newIndex]?.positions.eav || null
        );

        await mutate("retractFact", { id: data.id });
        await mutate("addCardToSection", {
          factID: ulid(),
          cardEntity: data.entityID,
          parent: props.parent,
          section: props.attribute,
          positions: {
            eav: position,
          },
        });
      } else {
        let currentIndex = siblings.findIndex(
          (f) => f.value.value === data.entityID
        );
        let newPositions = updatePositions("eav", siblings, [
          [siblings[currentIndex].id, newIndex - 1],
        ]);
        mutate("updatePositions", {
          positionKey: "eav",
          newPositions,
        });
      }
      action.end();
    },
  });
  let { close } = useCardViewer();

  let refs = useCombinedRefs(draggableRef, setNodeRef);

  return (
    <>
      <div
        ref={refs}
        style={{}}
        className={`pb-2 ${
          isDragging ? `opacity-60 ${isOverSomethingElse ? "-mt-2" : ""}` : ""
        }`}
      >
        {over && over.entityID !== props.entityID && over.type === "card" && (
          <div className="pb-2 opacity-60">
            <CardPreview
              data={over.data}
              entityID={over.entityID}
              size={"big"}
              hideContent={props.hideContent}
            />
          </div>
        )}
        {isOverSomethingElse ? null : (
          <CardPreview
            data={data}
            entityID={props.entityID}
            size="big"
            dragHandleProps={{ listeners, attributes }}
            hideContent={props.hideContent}
            onDelete={() => {
              mutate("retractFact", { id: props.id });
              close({ entityID: props.entityID });
            }}
          />
        )}
      </div>
    </>
  );
};
