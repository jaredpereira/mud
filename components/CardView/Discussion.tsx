import { ButtonPrimary } from "components/Buttons";
import { GoBackToPage, Member, Send } from "components/Icons";
import { useIndex, useMutations } from "hooks/useReplicache";
import { useState } from "react";
import { ulid } from "src/ulid";

export const Discussion = (props: { close: () => void; entityID: string }) => {
  return (
    <div className="flex flex-col gap-4 ">
      <div className="flex flex-col gap-2">
        <button onClick={() => props.close()}>
          <div className="flex items-center gap-2 text-accent-blue">
            <GoBackToPage /> back
          </div>
        </button>

        <Thought entityID={props.entityID} open={() => {}} />
      </div>
      <Messages entityID={props.entityID} />
      <MessageInput entityID={props.entityID} />
    </div>
  );
};

const MessageInput = (props: { entityID: string }) => {
  let [focused, setFocused] = useState(false);
  let [value, setValue] = useState("");
  let { mutate, memberEntity, authorized } = useMutations();
  if (!authorized) return null;
  return (
    <div className="sticky bottom-0 flex flex-col gap-2 px-2 pt-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="add your response..."
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`${
          focused || value ? "test-bg-pink h-32" : "h-10"
        } w-full resize-none overflow-hidden border-grey-80`}
        id="thoughtInput"
      ></textarea>
      {!focused && !value ? null : (
        <div className="flex items-center justify-end text-grey-55">
          <ButtonPrimary
            disabled={!value}
            onClick={async () => {
              if (!memberEntity) return;
              await mutate("replyToDiscussion", {
                discussion: props.entityID,
                message: {
                  id: ulid(),
                  topic: props.entityID,
                  ts: Date.now().toString(),
                  sender: memberEntity,
                  content: value,
                },
              });
              setValue("");
            }}
            icon={<Send />}
          />
        </div>
      )}
    </div>
  );
};

const Messages = (props: { entityID: string }) => {
  let messages = useIndex.messages(props.entityID);
  return (
    <div
      className="flex flex-col gap-6 px-3"
      style={{ wordBreak: "break-word" }} //no tailwind equiv - need for long titles to wrap
    >
      {messages.map((m) => (
        <Reply author={m.sender} date={m.ts} content={m.content} />
      ))}
    </div>
  );
};

export const Thought = (props: { entityID: string; open: () => void }) => {
  let content = useIndex.eav(props.entityID, "discussion/content");
  let author = useIndex.eav(props.entityID, "discussion/author");
  let authorName = useIndex.eav(author?.value.value || null, "member/name");
  let createdAt = useIndex.eav(props.entityID, "discussion/created-at");

  let time = createdAt
    ? new Date(createdAt?.value.value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";
  return (
    <button
      onClick={() => {
        props.open();
      }}
      className={`group flex flex-col gap-1 rounded-md border py-2 px-3 text-left ${"border-grey-80 bg-bg-blue text-grey-35"} `}
      style={{ wordBreak: "break-word" }} //no tailwind equiv - need for long titles to wrap
    >
      <div className="flex w-full items-baseline gap-2">
        <div className="font-bold">{authorName?.value}</div>
        <div className="text-sm">{time}</div>
      </div>
      <div className="">{content?.value}</div>
    </button>
  );
};

const Reply = (props: { content: string; author: string; date: string }) => {
  let memberName = useIndex.eav(props.author, "member/name");
  let time = new Date(parseInt(props.date));
  return (
    <div>
      <div className="flex gap-2 text-grey-55">
        <small className="font-bold">{memberName?.value}</small>
        <small>
          {time.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </small>
      </div>
      <div className="text-grey-35">{props.content} </div>
    </div>
  );
};
