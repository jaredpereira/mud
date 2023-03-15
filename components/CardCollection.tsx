import { Fact } from "data/Facts";
import {
  ReplicacheContext,
  scanIndex,
  useIndex,
  useMutations,
} from "hooks/useReplicache";
import { useContext } from "react";
import { generateKeyBetween } from "src/fractional-indexing";
import { sortByPosition, updatePositions } from "src/position_helpers";
import { ulid } from "src/ulid";
import { CardPreview } from "./CardPreview";
import { AddAttachedCard } from "./CardStack";
import { useCardViewer } from "./CardViewerContext";
import { useCombinedRefs } from "./Desktop";
import { useDraggableCard, useDroppableZone } from "./DragContext";
import {
  AddSmall,
  CollectionList as CollectionListIcon,
  CollectionPreview as CollectionPreviewIcon,
} from "./Icons";

export const CardCollection = (props: {
  entityID: string;
  attribute: "desktop/contains" | "deck/contains";
}) => {
  let cards = (useIndex.eav(props.entityID, props.attribute) || []).sort(
    sortByPosition("eav")
  );
  let collectionType = useIndex.eav(props.entityID, "collection/type");
  return (
    <>
      <CollectionHeader entityID={props.entityID} />
      <CollectionList
        attribute={props.attribute}
        entityID={props.entityID}
        cards={cards}
        size={collectionType?.value === "list" ? "small" : "big"}
      />
    </>
  );
};

const CollectionList = (props: {
  size: "small" | "big";
  entityID: string;
  attribute: "desktop/contains" | "deck/contains";
  cards: Fact<"desktop/contains" | "deck/contains">[];
}) => {
  let { open } = useCardViewer();
  let rep = useContext(ReplicacheContext);
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
    <div ref={setNodeRef} className="z-10 flex min-h-screen flex-col gap-y-2">
      {props.cards.length > 0 && (
        <AddAttachedCard
          onAdd={(entity) => {
            open({ entityID: entity });
          }}
          parent={props.entityID}
          positionKey="eav"
          attribute={props.attribute}
        >
          <div
            className={`relative mr-4 flex ${
              props.size === "big" ? "h-24" : "h-10"
            } w-full items-center justify-center rounded-lg border border-dashed text-grey-35`}
          >
            <AddSmall />
          </div>
        </AddAttachedCard>
      )}
      {props.cards?.map((card) => (
        <DraggableCard
          size="big"
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
            entityID={over.entityID}
            size={"big"}
            hideContent={props.size === "small"}
          />
        </div>
      )}
      <AddAttachedCard
        onAdd={(entity) => {
          open({ entityID: entity });
        }}
        end
        parent={props.entityID}
        positionKey="eav"
        attribute={props.attribute}
      >
        <div
          className={`relative mr-4 flex ${
            props.size === "big" ? "h-24" : "h-10"
          } w-full items-center justify-center rounded-lg border border-dashed text-grey-35`}
        >
          <AddSmall />
        </div>
      </AddAttachedCard>
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
    `p-1 text-grey-55 ${
      type === typeName
        ? "rounded-md border border-grey-55"
        : "border border-transparent"
    }`;

  return (
    <div className="collectionTypeSelector flex flex-row gap-1 place-self-end">
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
  size: "big" | "small";
  hideContent?: boolean;
  id: string;
  parent: string;
}) => {
  const { attributes, listeners, setNodeRef, isDragging, isOverSomethingElse } =
    useDraggableCard({
      type: "card",
      id: props.id,
      parent: props.parent,
      entityID: props.entityID,
      hideContent: !!props.hideContent,
      size: props.size,
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
        className={`${
          isDragging ? `opacity-60 ${isOverSomethingElse ? "-mt-2" : ""}` : ""
        }`}
      >
        {over && over.entityID !== props.entityID && over.type === "card" && (
          <div className="pb-2 opacity-60">
            <CardPreview
              entityID={over.entityID}
              size={"big"}
              hideContent={props.hideContent}
            />
          </div>
        )}
        {isOverSomethingElse ? null : (
          <CardPreview
            entityID={props.entityID}
            size={props.size}
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
