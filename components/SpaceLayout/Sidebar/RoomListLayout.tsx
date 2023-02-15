import { Popover } from "@headlessui/react";
import { ButtonPrimary } from "components/Buttons";
import { Modal, Divider } from "components/Layout";
import { Fact } from "data/Facts";
import { DeckSmall, Delete, Member, MoreOptionsTiny, Rooms } from "../../Icons";
import {
  ReplicacheContext,
  scanIndex,
  useIndex,
  useMutations,
} from "hooks/useReplicache";
import { useState, useEffect, useContext } from "react";
import { useSubscribe } from "replicache-react";

export const RoomListLabel = (props: {
  helpText: React.ReactNode;
  label: string;
}) => {
  return (
    <div className="flex flex-col gap-1 pb-1">
      <div className="flex justify-between">
        <small className="px-2 font-bold text-grey-55">{props.label}</small>
        <div className=" -mt-[2px] pr-2 ">
          <Popover className="">
            <Popover.Button>
              <span className="text-sm text-grey-55">
                <em>?</em>
              </span>
            </Popover.Button>
            <div className="absolute z-10">
              <Popover.Panel className="lightBorder absolute left-9 -top-6 z-50 flex w-[154px] flex-col gap-2 bg-white p-2 text-sm text-grey-55  sm:w-56">
                <div className="flex flex-col gap-1">{props.helpText}</div>
              </Popover.Panel>
            </div>
          </Popover>
        </div>
      </div>
      <div className="w-full border-t border-dashed border-grey-80" />
    </div>
  );
};

export const EditRoomModal = (props: {
  open: boolean;
  onClose: () => void;
  currentRoom: string | null;
}) => {
  let currentRoom:
    | Fact<"room/name">
    | Fact<"member/name">
    | Fact<"promptroom/name">
    | null = null;
  let isMember = false;
  let isPromptRoom = false;
  let sharedRoom = useIndex.eav(props.currentRoom, "room/name");
  let memberRoom = useIndex.eav(props.currentRoom, "member/name");
  let promptRoom = useIndex.eav(props.currentRoom, "promptroom/name");

  if (memberRoom) {
    currentRoom = memberRoom;
    isMember = true;
  } else if (promptRoom) {
    currentRoom = promptRoom;
    isPromptRoom = true;
  } else currentRoom = sharedRoom;

  let { mutate } = useMutations();
  let [formState, setFormState] = useState(currentRoom?.value || "");

  useEffect(() => {
    setFormState(currentRoom?.value || "");
  }, [currentRoom?.value]);

  if (!props.currentRoom) return null;
  let entityID = props.currentRoom;

  return (
    <Modal open={props.open} onClose={props.onClose}>
      <div className="editRoomModal flex flex-col gap-3 text-grey-35">
        <h3>Room Settings</h3>
        {isMember ? (
          <p className="italic text-grey-55">nothing to edit... yet ;)</p>
        ) : (
          <>
            <div className="editRoomName flex flex-col gap-1">
              <p className="font-bold">Room Name</p>
              <input
                className="w-full"
                value={formState}
                placeholder={currentRoom?.value}
                onChange={(e) => {
                  let value = e.currentTarget.value;
                  setFormState(value);
                }}
              />
            </div>
            <ButtonPrimary
              content="Edit Room!"
              onClick={async () => {
                await mutate("assertFact", {
                  entity: entityID,
                  attribute: isPromptRoom ? "promptroom/name" : "room/name",
                  value: formState,
                  positions: {},
                });
                setFormState("");
                props.onClose();
              }}
            />

            <Divider />
            {isMember ? null : (
              <ButtonPrimary
                destructive
                onClick={async () => {
                  await mutate("deleteEntity", { entity: entityID });
                  setFormState("");
                  props.onClose();
                }}
                content="Delete this room"
                icon={<Delete />}
              />
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export const RoomListItem = (props: {
  onRoomChange: (room: string) => void;
  children: React.ReactNode;
  currentRoom: string | null;
  roomEntity: string;
  setRoomEditOpen: () => void;
}) => {
  let { memberEntity, authorized } = useMutations();
  let roomType = useIndex.eav(props.roomEntity, "room/type");

  let rep = useContext(ReplicacheContext);
  let unreadCount = useSubscribe(
    rep?.rep,
    async (tx) => {
      if (!memberEntity) return 0;
      let unreads = 0;
      // NB - currently collections also use 'desktop/contains'
      let cards = await scanIndex(tx).eav(props.roomEntity, "desktop/contains");
      for (let card of cards) {
        let unread = (
          await scanIndex(tx).eav(card.value.value, "card/unread-by")
        ).find((f) => f.value.value === memberEntity);
        if (unread) unreads += 1;
      }
      return unreads;
    },
    0,
    [memberEntity]
  );

  return (
    <div
      className={`relative flex w-full items-center gap-1 rounded-md border border-transparent text-left ${
        props.roomEntity === props.currentRoom
          ? "rounded-md bg-accent-blue font-bold text-white"
          : " text-grey-35 hover:border-grey-80"
      }`}
    >
      {/* buttom = name + either edit button OR room type icon */}
      <button
        style={{ wordBreak: "break-word" }} //no tailwind equiv - need for long titles to wrap
        className="sidebarRoomName flex w-full flex-row gap-1 py-0.5 pl-1 pr-1 text-left"
        onClick={() => props.onRoomChange(props.roomEntity)}
      >
        {props.roomEntity === props.currentRoom && authorized ? (
          // edit options - only if auth-ed AND on current room
          <div className="flex w-6 shrink-0 place-content-center pt-0.5">
            <button
              onClick={() => props.setRoomEditOpen()}
              className={`sidebarRoomOptions rounded-md border border-transparent hover:border-white`}
            >
              <MoreOptionsTiny />
            </button>
          </div>
        ) : // when not on room, show room type icon
        roomType?.value === "collection" ? (
          <div className="w-6">
            <DeckSmall />
          </div>
        ) : roomType?.value === "canvas" ? (
          <div className="w-6">
            <Rooms />
          </div>
        ) : null}
        <div className="">{props.children}</div>
      </button>
      {!!unreadCount && unreadCount > 0 && (
        <div className="unreadCount mr-1 flex h-[24px] w-[24px] shrink-0 place-content-center items-center rounded-full bg-accent-gold text-center text-xs text-grey-15">
          {unreadCount}
        </div>
      )}
    </div>
  );
};
