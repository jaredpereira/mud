import {
  Active,
  closestCorners,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  ReplicacheContext,
  scanIndex,
  useMutations,
} from "hooks/useReplicache";
import { useContext, useState } from "react";
import { sortByPosition, updatePositions } from "src/position_helpers";
import { StackData } from "./CardStack";
import { animated, useTransition } from "@react-spring/web";
import { createPortal } from "react-dom";
import { useSortable } from "@dnd-kit/sortable";

export const SmallCardDragContext = (props: {
  children: React.ReactNode;
  activationConstraints?: { delay: number; tolerance: number };
  noDeleteZone?: boolean;
}) => {
  let [activeCard, setActiveCard] = useState<Active | null>(null);
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: props.activationConstraints,
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: props.activationConstraints,
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  let { mutate } = useMutations();
  let rep = useContext(ReplicacheContext);
  return (
    <DndContext
      collisionDetection={closestCorners}
      sensors={sensors}
      onDragStart={({ active }) => {
        setActiveCard(active);
      }}
      onDragOver={({}) => {}}
      onDragEnd={async (data) => {
        let { over, active } = data;
        setActiveCard(null);
        if (!over || !rep?.rep) return;
        if (!active.data.current) return;
        let overData = over.data.current as Data;
        let activeData = active.data.current as Data;
        if (over.id === "delete") {
          mutate("retractFact", { id: activeData.factID });
          return;
        }
        let siblings;
        if (!overData.parent) {
          siblings = (
            await rep.rep.query((tx) => {
              return scanIndex(tx).aev(overData.attribute);
            })
          ).sort(sortByPosition(overData.positionKey));
        } else {
          siblings = (
            await rep.rep.query((tx) => {
              return scanIndex(tx).eav(overData.parent, overData.attribute);
            })
          ).sort(sortByPosition(overData.positionKey));
        }
        let currentIndex = siblings.findIndex((f) =>
          !overData.parent
            ? f.entity === activeData.entityID
            : f.value.value === activeData.entityID
        );
        let newIndex = siblings.findIndex((f) =>
          !overData.parent
            ? f.entity === overData.entityID
            : f.value.value === overData.entityID
        );
        let newPositions = updatePositions(overData.positionKey, siblings, [
          [
            siblings[currentIndex].id,
            currentIndex < newIndex ? newIndex : newIndex - 1,
          ],
        ]);
        console.log(newPositions);
        mutate("updatePositions", {
          positionKey: overData.positionKey,
          newPositions,
        });
      }}
    >
      {props.children}
      <DragOverlayCard entityID={activeCard?.data.current?.entityID} />
    </DndContext>
  );
};

const DragOverlayCard = (props: { entityID?: string }) => {
  return (
    <DragOverlay dropAnimation={null}>
      {props.entityID ? <div className="relative top-2"></div> : null}
    </DragOverlay>
  );
};

type Data = StackData & {
  entityID: string;
  factID: string;
};
export const useSortableCard = (c: { id: string; data: Data }) =>
  useSortable(c);
