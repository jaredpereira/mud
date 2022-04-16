import { Menu, Transition } from "@headlessui/react";
import Textarea from "components/AutosizeTextArea";
import { ButtonPrimary } from "components/Buttons";
import { SmallCardList } from "components/DeckList";
import { FindOrCreateCard } from "components/FindOrCreateEntity";
import {
  Close,
  DownArrow,
  MoreOptions,
  SectionLinkedCard,
  SectionText,
  UpArrow,
} from "components/Icons";
import { multipleReferenceSection, singleTextSection } from "data/Facts";
import { ReplicacheContext, useIndex } from "hooks/useReplicache";
import { Fragment, useContext, useRef, useState } from "react";
import { generateKeyBetween } from "src/fractional-indexing";
import { sortByPosition } from "src/position_helpers";
import { ulid } from "src/ulid";

export const Sections = (props: { entityID: string }) => {
  let sections = useIndex.eav(props.entityID, "card/section");
  return (
    <div className="grid grid-auto-row gap-6">
      {sections?.map((s) => (
        <Section name={s.value} entityID={props.entityID} key={s.value} />
      ))}
    </div>
  );
};

const Section = (props: { name: string; entityID: string }) => {
  let entity = useIndex.ave("name", `section/${props.name}`);
  let cardinality = useIndex.eav(entity?.entity || null, "cardinality");
  let type = useIndex.eav(entity?.entity || null, "type");
  return (
    <div className="textSection grid grid-auto-rows gap-2">
      <div className="grid grid-cols-[auto_min-content_min-content] gap-2 items-center">
        <h4>{props.name}</h4>
        <div className="text-grey-55">
          {type?.value === "string" ? <SectionText /> : <SectionLinkedCard />}
        </div>
        <SectionMoreOptionsMenu />
      </div>
      {type?.value === "string" ? (
        <SingleTextSection entityID={props.entityID} section={props.name} />
      ) : type?.value === "reference" && cardinality?.value === "many" ? (
        <MultipleReferenceSection
          section={props.name}
          entityID={props.entityID}
        />
      ) : null}
    </div>
  );
};

const SingleTextSection = (props: {
  entityID: string;
  section: string;
  new?: boolean;
}) => {
  let fact = useIndex.eav(props.entityID, singleTextSection(props.section));
  let inputEl = useRef<HTMLTextAreaElement | null>(null);
  let rep = useContext(ReplicacheContext);
  return (
    <Textarea
      autoFocus={props.new}
      ref={inputEl}
      className="w-full"
      value={(fact?.value as string) || ""}
      onChange={async (e) => {
        let start = e.currentTarget.selectionStart,
          end = e.currentTarget.selectionEnd;
        await rep?.rep.mutate.assertFact({
          entity: props.entityID,
          attribute: singleTextSection(props.section),
          value: e.currentTarget.value,
          positions: fact?.positions || {},
        });
        inputEl.current?.setSelectionRange(start, end);
      }}
    />
  );
};

const MultipleReferenceSection = (props: {
  entityID: string;
  section: string;
}) => {
  let attribute = multipleReferenceSection(props.section);
  let references = useIndex.eav(props.entityID, attribute);
  let rep = useContext(ReplicacheContext);
  let earliestCard = references?.sort(sortByPosition("eav"))[0];
  let [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      <ButtonPrimary
        onClick={() => setOpen(true)}
        content="search to add cards"
      />
      <FindOrCreateCard
        open={open}
        onClose={() => setOpen(false)}
        selected={references?.map((c) => c.value.value) || []}
        onSelect={async (e) => {
          let position = generateKeyBetween(
            null,
            earliestCard?.positions["eav"] || null
          );
          let entity;

          if (e.type === "create") {
            entity = ulid();
            await rep?.rep.mutate.createCard({
              entityID: entity,
              title: e.name,
            });
          } else {
            entity = e.entity;
          }

          rep?.rep.mutate.addCardToSection({
            cardEntity: entity,
            parent: props.entityID,
            positions: { eav: position },
            section: attribute,
          });
          //TODO
        }}
      />
      <SmallCardList
        attribute={attribute}
        cards={references || []}
        deck={props.entityID}
        positionKey="eav"
      />
    </div>
  );
};

const SectionMoreOptionsMenu = () => {
  return (
    <Menu as="div" className="relative">
      <Menu.Button>
        <MoreOptions />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="px-3 py-4 border border-grey-80 rounded-md shadow-drop bg-white absolute justify-items-end flex flex-col gap-3 text-right origin-top-right right-0 z-40 w-max">
          <Menu.Item>
            <button className="flex items-center gap-2 justify-end">
              <p>Move Up</p>
              <UpArrow />
            </button>
          </Menu.Item>
          <Menu.Item>
            <button className="flex items-center gap-2 justify--end">
              <p>Move Down</p>
              <DownArrow />
            </button>
          </Menu.Item>
          <Menu.Item>
            <button className="flex items-center gap-2 justify-end">
              <p>Remove</p>
              <Close />
            </button>
          </Menu.Item>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};
