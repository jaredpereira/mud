import React, { useEffect, useState } from "react";
import {
  scanIndex,
  useIndex,
  useMutations,
  useSpaceID,
} from "hooks/useReplicache";
import { ulid } from "src/ulid";
import Head from "next/head";
import { useAuth } from "hooks/useAuth";
import { Textarea } from "components/Textarea";
import {
  Card,
  Cross,
  DeckSmall,
  Member,
  SectionLinkedCard,
  Send,
} from "components/Icons";
import { useRouter } from "next/router";
import Link from "next/link";
import { FindOrCreate, useAllItems } from "components/FindOrCreateEntity";
import { SmallCard } from "components/SmallCard";
import { RenderedText } from "components/Textarea/RenderedText";
import { spacePath } from "hooks/utils";
import { CardPreview } from "components/CardPreview";

export default function ChatPage() {
  let id = useSpaceID();
  let spaceName = useIndex.aev("this/name")[0];
  return (
    <div className="h-full flex flex-col relative items-stretch max-w-3xl mx-auto text-[15px] leading-[24px]">
      <Head>
        <title key="title">{spaceName?.value}</title>
      </Head>
      <Messages topic="general" />
      <div className="pb-6">
        <MessageInput id={id || ""} topic={"general"} />
      </div>
    </div>
  );
}

export const Messages = (props: { topic: string }) => {
  let messages = useIndex.messages(props.topic);
  let { rep } = useAuth();
  let id = useSpaceID();
  let lastMessage = messages[messages.length - 1];
  let spaceName = useIndex.aev("this/name")[0];

  useEffect(() => {
    rep?.query(async (tx) => {
      if (!id || !lastMessage?.index) return;
      let q = scanIndex(tx);

      let space = await q.ave("space/id", id);
      if (!space) return;

      let latest = await q.eav(space.entity, "space/lastSeenMessage");
      if (latest && latest.value > lastMessage.index) return;

      rep?.mutate.updateLastSeenMessage({
        space: id,
        lastSeenMessage: lastMessage.index,
      });
    });
  }, [messages]);

  return (
    <React.Fragment>
      <div className=" h-full overflow-y-auto overflow-x-hidden pb-6 flex flex-col-reverse ">
        <div className=" flex flex-col pr-2">
          {/* if no messages, show welcome placeholder */}
          {messages.length == 0 ? (
            <Placeholder spaceName={spaceName?.value} />
          ) : (
            messages.map((m, index) => {
              return (
                <Message
                  key={m.id}
                  entity={m.entity}
                  sender={m.sender}
                  attachedCards={m.attachedCards}
                  ts={m.ts}
                  content={m.content}
                  doubleSend={
                    messages[index - 1]?.sender === m.sender &&
                    parseInt(m.ts) - parseInt(messages[index - 1].ts) < 300000
                  }
                />
              );
            })
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

const Placeholder = (props: { spaceName: string }) => {
  return (
    <>
      <div className="MessageSender font-bold">The Hyperlink Team</div>
      <p className="pb-4">
        You're exploring {props.spaceName} — welcome to the chat!
      </p>
      <ul className="pb-4">
        <li>~ Use this as a group chat</li>
        <li>~ Or as a log/journal/stream!</li>
        <li>~ Attach decks and cards</li>
        <li>~ Converse with bots</li>
      </ul>
      <p className="pb-4">
        <em>This note will disappear once you send the first message…</em>
      </p>
      {/* prettier-ignore */}
      <pre className="MessageContent whitespace-pre-wrap text-grey-35">
{/* NB: looks weird below b/c it renders as Quattro, not monospace! */}
{/* also includes several thin spaces and hair spaces lmao */}
{"  "}____________________________{"\n"}
{" "}/--------------------------/|{"\n"}
|  ====           *-* ~~~~~~         ||{"\n"}
|  ====         {"\{     \}"}~~~~~~    ||{"\n"}
|                  *-* ~~~~~~     ||{"\n"}
|                                    ||{"\n"}
|                ========           ||{"\n"}
|                  ======          |/{"\n"}
{" "}----------------------------{"\n"}
              </pre>
    </>
  );
};

const Message = (props: {
  entity?: string;
  sender: string;
  ts: string;
  content: string;
  attachedCards?: string[];
  doubleSend: boolean;
}) => {
  let member = useIndex.ave("member/name", props.sender);
  let q = useRouter().query;
  return (
    <div
      className={`grid grid-cols-[max-content_auto] gap-2 sm:gap-3 ${
        props.doubleSend ? "pt-2" : "pt-4 sm:pt-5 "
      }`}
    >
      <div className={`h-6 w-6 mt-.5 `}>
        {props.doubleSend ? null : <Member />}
      </div>
      <div className={`messageWrapper flex flex-col group`}>
        {props.doubleSend ? null : (
          <div className=" messageHeader pb-1 grid grid-cols-[auto_max-content]">
            <Link href={`${spacePath(q.studio, q.space)}/c/${member?.entity}`}>
              <div className={`messageSender font-bold `}>{props.sender}</div>
            </Link>
            <div className="messageInfo hidden group-hover:block italic text-grey-80">
              {new Date(parseInt(props.ts)).toLocaleDateString()}
            </div>
          </div>
        )}
        <RenderedText
          text={props.content}
          className="messageContent  whitespace-pre-wrap font-[Quattro] "
        />
        {!props.entity ? null : <MessageData entity={props.entity} />}
      </div>
    </div>
  );
};

const MessageData = (props: { entity: string }) => {
  let { studio, space } = useRouter().query;
  let attachedCards = useIndex.eav(props.entity, "message/attachedCard") || [];

  return (
    <div className="flex flex-wrap gap-2 pt-2 pb-1">
      {attachedCards?.map((e) => {
        return (
          <CardPreview
            size={"small"}
            entityID={e.value.value}
            key={e.id}
            href={``}
          />
        );
      })}
    </div>
  );
};

export const MessageInput = (props: { id: string; topic: string }) => {
  let [message, setMessage] = useState("");
  let [attachedCards, setAttachedCards] = useState<string[]>([]);
  let messages = useIndex.messages(props.topic);
  let { session } = useAuth();
  useEffect(() => {
    let storedMsg = localStorage.getItem(
      `chatinput-${props.id}-${session?.session?.studio}`
    );
    if (storedMsg) setMessage((m) => (m ? m : (storedMsg as string)));
  }, [props.id, session]);
  useEffect(() => {
    localStorage.setItem(
      `chatinput-${props.id}-${session?.session?.studio}`,
      message
    );
  }, [message]);
  let { authorized, mutate, memberEntity } = useMutations();
  let [inputFocused, setInputFocused] = useState(false);

  // STATE OF MESSAGE INPUT IF NOT LOGGED IN
  if (!authorized) {
    return (
      <div className=" text-grey-55 italic border-t border-grey-80 -mx-3 md:mx-0 px-4 pt-2 pb-2">
        <div className="bg-grey-90 p-2 rounded-md">
          Log in to send a message!
        </div>
      </div>
    );
  }

  const submit = async () => {
    if (
      !authorized ||
      !session.session ||
      (!message && attachedCards.length === 0)
    )
      return;

    let messageId = ulid();
    let entity: string | undefined;
    if (attachedCards.length > 0) {
      entity = ulid();
      await mutate("assertFact", {
        entity,
        attribute: "message/id",
        value: messageId,
        positions: {},
      });
      await Promise.all(
        attachedCards.map((c) =>
          mutate("addCardToSection", {
            cardEntity: c,
            parent: entity as string,
            section: "message/attachedCard",
            positions: {},
          })
        )
      );
    }
    if (!memberEntity) return;
    mutate("postMessage", {
      id: ulid(),
      entity,
      member: memberEntity,
      attachedCards,
      topic: props.topic,
      content: message,
      sender: session.session.username,
      ts: Date.now().toString(),
    });
    setMessage("");
    setAttachedCards([]);
  };

  return (
    // the message input is 16px and the rest of chat is 15px.
    // this is because on mobile, browsers will automatically zoom in if you click on form elements with font size less thn 16px
    <div className="-mx-3 md:mx-0 px-4 md:px-4 pt-4 pb-4 border-t text-base border-grey-80 gap-2  rounded-none">
      {/* ATTACHED CARDS IN MESSAGE INPUT */}
      <div
        className={`${
          attachedCards.length > 0
            ? "flex flex-col gap-0 pb-4 mb-4 border-b border-grey-80 border-dashed"
            : "hidden"
        }`}
      >
        <h4 className="pb-1">Attached Cards</h4>
        {attachedCards.map((e) => {
          return (
            <AttachedCard
              entityID={e}
              key={e}
              remove={() => setAttachedCards((a) => a.filter((c) => c !== e))}
            />
          );
        })}
      </div>

      {/* VANILLA MESSAGE INPUT  */}
      <div className="flex flex-row-reverse items-center gap-2">
        <div
          onMouseDown={(e) => e.preventDefault()}
          className={` ${
            inputFocused
              ? "flex flex-row justify-end self-end rounded-md gap-4"
              : // : "hidden"
                "flex flex-row justify-end self-end rounded-md gap-4"
          } `}
        >
          <FindOrCreateCard
            selected={attachedCards}
            onSelect={(e) => setAttachedCards((a) => [...a, e])}
          />
          <button
            className="text-accent-blue"
            onClick={(e) => {
              e.preventDefault;
              if (!authorized || !session.session || !message) return;
              submit();
            }}
          >
            <div className="flex gap-2 font-bold">
              <Send />
            </div>
          </button>
        </div>
        <Textarea
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          className="bg-inherit w-full"
          placeholder="write a message"
          value={message}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (e.shiftKey) {
                return;
              }
              e.preventDefault();
              submit();
            }
            if (e.key === "ArrowUp" && !message) {
              if (!session.session) return;
              let last = messages
                .reverse()
                .find((f) => f.sender === session.session?.username);
              if (last) setMessage(last.content);
              if (last?.attachedCards) setAttachedCards(last.attachedCards);
            }
          }}
          onChange={(e) => setMessage(e.currentTarget.value)}
        />
      </div>
    </div>
  );
};

const AttachedCard = (props: { entityID: string; remove: () => void }) => {
  let title = useIndex.eav(props.entityID, "card/title");
  let memberName = useIndex.eav(props.entityID, "member/name");
  let isDeck = useIndex.eav(props.entityID, "deck");

  return (
    <div className="grid grid-cols-[max-content_auto_max-content] place-items-start gap-2 hover:bg-bg-blue py-1 px-2 -mx-2 rounded-md">
      <div className="pt-0.5">
        {!!memberName ? <Member /> : isDeck ? <DeckSmall /> : <Card />}
      </div>
      {memberName?.value || title?.value}
      <button className="text-grey-55 pt-1" onClick={() => props.remove()}>
        <Cross />
      </button>
    </div>
  );
};

const FindOrCreateCard = (props: {
  onSelect: (e: string) => void;
  selected: string[];
}) => {
  let [open, setOpen] = useState(false);
  let { mutate } = useMutations();
  let items = useAllItems(open);

  return (
    <>
      <button className="text-grey-80" onClick={() => setOpen(true)}>
        <SectionLinkedCard className="hover:text-accent-blue text-grey-35" />
      </button>
      <FindOrCreate
        allowBlank={false}
        onClose={() => setOpen(false)}
        open={open}
        items={items}
        selected={props.selected}
        onSelect={async (e) => {
          let entity;
          if (e.type === "create") {
            entity = ulid();
            await mutate("createCard", {
              entityID: entity,
              title: e.name,
            });
          } else {
            entity = e.entity;
          }

          props.onSelect(entity);
        }}
      />
    </>
  );
};
