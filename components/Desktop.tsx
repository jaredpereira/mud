import {
  ReplicacheContext,
  scanIndex,
  useIndex,
  useMutations,
} from "hooks/useReplicache";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useContext, useEffect, useMemo, useState } from "react";
import { CardPreview } from "./CardPreview";
import { customCollisionDetection } from "src/customCollisionDetection";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { ulid } from "src/ulid";
import { useRouter } from "next/router";
import { FindOrCreate, useAllItems } from "./FindOrCreateEntity";
import { useSubscribe } from "replicache-react";
import { ButtonSecondary } from "./Buttons";
import { ActionBar } from "./ActionBar";

const GRID_SIZE = 16;
const snap = (x: number) => Math.ceil(x / GRID_SIZE) * GRID_SIZE;

export const Desktop = (props: { entityID: string }) => {
  let cards = useIndex.eav(props.entityID, "desktop/contains");
  let height = useHeight(props.entityID) + 500;
  const mouseSensor = useSensor(MouseSensor, {});
  const touchSensor = useSensor(TouchSensor, {});
  const sensors = useSensors(mouseSensor, touchSensor);
  let { mutate, action } = useMutations();
  let [createCard, setCreateCard] = useState<null | { x: number; y: number }>(
    null
  );
  let [draggingHeight, setDraggingHeight] = useState(0);
  let [selection, setSelection] = useState<string[]>([]);
  let [selectionDragTransform, setSelectionDragTransform] =
    useState<string>("");

  useEffect(() => {
    let handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection([]);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [])

  return (
    <DndContext
      sensors={sensors}
      modifiers={[
        (args) => {
          let { transform } = args;
          return {
            ...transform,
            x: snap(transform.x),
            y: snap(transform.y),
          };
        },
        restrictToParentElement,
      ]}
      collisionDetection={customCollisionDetection}
      onDragMove={({ delta, active }) => {
        let transform = `translate3d(${delta.x}px, ${delta.y}px, 0px)`;
        setSelectionDragTransform(transform);

        if(selection.length > 0 && !selection.includes(active.id as string)) {
          setSelection((oldValue) => {
            return [...oldValue, active.id as string]
          })
        }

        let position: { y: number } = active.data.current?.position;
        if (!position) return;
        let h = height;
        if (position.y + delta.y + 200 > h)
          setDraggingHeight((oldValue) => {
            let newValue = position.y + delta.y + 200;
            return newValue > oldValue ? newValue : oldValue;
          });
      }}
      onDragEnd={async (dragProps) => {
        let { active, delta, over } = dragProps;

        setSelectionDragTransform('')

        action.start();

        setDraggingHeight(0);

        let elementsToUpdate = selection.length > 0 ? selection : [active.id]

        for(let id of elementsToUpdate) {
          if(over && !selection.includes(over.id as string)) {
            let entityID = cards?.find((f) => f.id == id)?.value.value

            if(entityID) {
              await mutate("addToOrCreateDeck", {
                droppedCardPositionFact: id as string,
                droppedCardEntity: entityID,
                targetCardEntity: over.data.current?.entityID,
                desktop: props.entityID,
                factID: ulid()
              });
            }
          } else {
            await mutate("updatePositionInDesktop", {
              factID: id as string,
              parent: props.entityID,
              dx: delta.x,
              dy: delta.y,
              da: 0,
            });
          }
        }

        action.end();
      }}
    >
      <AddCard
        position={createCard}
        onClose={() => setCreateCard(null)}
        desktopEntity={props.entityID}
      />
      <PromptManager entityID={props.entityID} />
      {/* TO DO - CELINE: make desktopBackground fit - full bleed! */}
      <div className="overflow-y-scroll sm:p-4">
        <div className="relative flex w-[336px] flex-col items-stretch gap-0">
          <div className="desktopBackground absolute h-full w-full" />
          {/* Handles Double CLick to Create */}
          <div
            onClick={(e) => {
              if (e.currentTarget !== e.target) return;
              let parentRect = e.currentTarget.getBoundingClientRect();
              setSelection([]);
              if (e.ctrlKey) {
                action.start();
                mutate("addCardToDesktop", {
                  entity: ulid(),
                  factID: ulid(),
                  desktop: props.entityID,
                  position: {
                    rotation: 0,
                    size: "big",
                    x: Math.max(e.clientX - parentRect.left - 128, 0),
                    y: Math.max(e.clientY - parentRect.top - 42, 0),
                  },
                });
                action.end();
              }
              if (e.detail === 2) {
                setCreateCard({
                  x: e.clientX - parentRect.left,
                  y: e.clientY - parentRect.top,
                });
              }
            }}
            style={{
              zIndex: 1,
              height: `${draggingHeight > height ? draggingHeight : height}px`,
              position: "relative",
            }}
            className="text-sm"
          >
            {cards?.map((card) => (
              <DraggableCard
                key={card.id}
                relationshipID={card.id}
                entityID={card.value.value}
                parent={props.entityID}
                setSelection={setSelection}
                isSelected={selection.includes(card.id)}
                selectionMode={selection.length > 0}
                dragTransform={selection.includes(card.id) ? selectionDragTransform : ''}
              />
            ))}
          </div>
          {/* <HelpToast helpText={`double click/tap to create new`} /> */}
        </div>
      </div>

      <ActionBar selection={selection} setSelection={setSelection} />
    </DndContext>
  );
};

let PromptManager = (props: { entityID: string }) => {
  let name = useIndex.eav(props.entityID, "member/name");
  let { mutate, memberEntity } = useMutations();
  if (!name || memberEntity !== props.entityID) return null;
  return (
    <div className="relative w-full">
      <div className="absolute z-10 flex w-full justify-center gap-2">
        <ButtonSecondary
          content="Draw a Prompt"
          onClick={() => {
            mutate("drawAPrompt", {
              factID: ulid(),
              desktopEntity: props.entityID,
              randomSeed: Math.random(),
            });
          }}
        />
        <DailyPromptsButton entityID={props.entityID} />
      </div>
    </div>
  );
};

let DailyPromptsButton = (props: { entityID: string }) => {
  let prompts = useIndex.at(
    "card/date",
    new Date().toLocaleDateString("en-CA")
  );
  let cards = useIndex.eav(props.entityID, "desktop/contains") || [];
  let newPrompts = prompts.filter(
    (p) => !cards.find((c) => c.value.value === p.entity)
  );
  let { mutate } = useMutations();
  return (
    <ButtonSecondary
      disabled={newPrompts.length === 0}
      content="Today's Prompts"
      onClick={async () => {
        for (let i = 0; i < newPrompts.length; i++) {
          let prompt = newPrompts[i];
          await mutate("addCardToDesktop", {
            entity: prompt.entity,
            factID: ulid(),
            desktop: props.entityID,
            position: {
              y: 64 + 64 * i,
              x: 128,
              size: "small",
              rotation: 0,
            },
          });
        }
      }}
    />
  );
};

let useHeight = (entity: string) => {
  let rep = useContext(ReplicacheContext);
  return useSubscribe(
    rep?.rep,
    async (tx) => {
      let cards = await scanIndex(tx).eav(entity, "desktop/contains");
      return await cards.reduce(async (acc, card) => {
        let position = await scanIndex(tx).eav(card.id, "card/position-in");
        if (position && position.value.y + 200 > (await acc))
          return position.value.y + 200;
        return acc;
      }, Promise.resolve(800));
    },
    800,
    [entity]
  );
};

const DraggableCard = (props: {
  entityID: string;
  parent: string;
  relationshipID: string;
  isSelected: boolean;
  selectionMode: boolean;
  dragTransform: string;
  setSelection: React.Dispatch<React.SetStateAction<string[]>>;
}) => {
  let position = useIndex.eav(props.relationshipID, "card/position-in");
  let { mutate } = useMutations();
  let { query: q } = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: props.relationshipID,
      data: { entityID: props.entityID, position: position?.value },
    });
  let { setNodeRef: draggableRef, isOver: _isOver } = useDroppable({
    id: props.relationshipID,
    disabled: isDragging,
    data: { entityID: props.entityID },
  });
  let isOver = _isOver && !props.isSelected;
  let refs = useCombinedRefs(setNodeRef, draggableRef);

  const style = transform && (Math.abs(transform.x) > 0 || Math.abs(transform.y) > 0)
    ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
    : "";

  let dragTransform = props.dragTransform || style
  let hasMoved = dragTransform != ''


  let toggleSelection = () => {
    props.setSelection?.((oldValue:string[]) => {
      if (oldValue.includes(props.relationshipID)) {
        return oldValue.filter((id) => id !== props.relationshipID);
      } else {
        return [...oldValue, props.relationshipID];
      }
    });
  }

  let pointerUpHandler = (e: React.PointerEvent) => {
    if(!hasMoved && props.selectionMode && e.button === 0) toggleSelection()
  }

  let y = position?.value.y || 0;
  let x = position?.value.x || 0;
  return (
    <>
      {/* This handles the canvas position and card size*/}
      <div
        style={{
          zIndex: isDragging
            ? 100000
            : Math.floor(y / 10) * 100 + Math.floor(x / 10),
          transform: dragTransform,
          top: snap(y) + "px",
          left: snap(x) + "px",
          width: position?.value.size === "big" ? "288px" : "fit-content",
        }}
        ref={refs}
        className="absolute touch-none"
      >
        {/* This handles the rotation */}
        <div
          className={`${isOver ? "scale-105" : ""}`}
          style={{
            transform: `rotate(${
              !position
                ? 0
                : (
                    Math.floor(position.value.rotation / (Math.PI / 24)) *
                    (Math.PI / 24)
                  ).toFixed(2)
            }rad) ${isOver ? "scale(1.05)" : ""}`,
          }}
        >
          {/* This is the actual card and its buttons. It also handles size */}
          <CardPreview
            factID={props.relationshipID}
            onRotateDrag={(da) => {
              mutate("updatePositionInDesktop", {
                factID: props.relationshipID,
                parent: props.parent,
                dx: 0,
                dy: 0,
                da,
              });
            }}
            onDelete={() => {
              mutate("retractFact", { id: props.relationshipID });
            }}
            dragHandleProps={{ listeners, attributes }}
            size={position?.value.size || "small"}
            onResize={async (size) => {
              return await mutate("updatePositionInDesktop", {
                factID: props.relationshipID,
                size: size,
                parent: props.parent,
                dx: 0,
                dy: 0,
                da: 0,
              });
            }}
            isOver={isOver}
            isDragging={hasMoved}
            onLongPress={toggleSelection}
            pointerUpHandler={pointerUpHandler}
            {...props}
          />
        </div>
      </div>
    </>
  );
};

const AddCard = (props: {
  onClose: () => void;
  desktopEntity: string;
  position: null | { x: number; y: number };
}) => {
  let items = useAllItems(!!props.position);
  let { mutate, memberEntity, action } = useMutations();
  return (
    <FindOrCreate
      items={items}
      open={!!props.position}
      allowBlank={true}
      onClose={() => props.onClose()}
      onSelect={async (cards) => {
        if (!props.position || !memberEntity) return;
        let entity;

        action.start();
        for (let d of cards) {
          if (d.type === "create") {
            entity = ulid();
            await mutate("createCard", {
              entityID: entity,
              title: d.name,
              memberEntity,
            });
          } else {
            entity = d.entity;
          }

          await mutate("addCardToDesktop", {
            entity,
            factID: ulid(),
            desktop: props.desktopEntity,
            position: {
              rotation: 0,
              size: "small",
              x: Math.max(props.position.x - 128, 0),
              y: Math.max(props.position.y - 42, 0),
            },
          });
        }

        action.end();
      }}
      selected={[]}
    />
  );
};

export const HelpToast = (props: { helpText: string }) => {
  return (
    <div className="fixed bottom-20 flex w-[320px] justify-center">
      <div className="rounded-full px-2 py-1 text-center italic text-grey-80">
        * {props.helpText} *
      </div>
    </div>
  );
};

export function useCombinedRefs<T>(
  ...refs: ((node: T) => void)[]
): (node: T) => void {
  return useMemo(
    () => (node: T) => {
      refs.forEach((ref) => ref(node));
    },
    refs
  );
}
