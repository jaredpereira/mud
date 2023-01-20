import { useAuth } from "hooks/useAuth";
import Link from "next/link";
import useSWR from "swr";
import { useRouter } from "next/router";
import { BackToStudio as BackToStudioIcon, Note } from "../Icons";
import { spacePath } from "hooks/utils";
import { useIndex, useSpaceID } from "hooks/useReplicache";
import { useState } from "react";
import { ButtonSecondary } from "../Buttons";
import { LogInModal } from "../LoginModal";
import { spaceAPI } from "backend/lib/api";
import { useSmoker } from "../Smoke";
import { Popover } from "@headlessui/react";
import { animated, useSpring } from "@react-spring/web";
import useMeasure from "react-use-measure";
import { Divider, Modal } from "components/Layout";
import { BaseSmallCard } from "components/CardPreview/SmallCard";

export const SpaceHeader: React.FC<React.PropsWithChildren<unknown>> = () => {
  let { session } = useAuth();

  return (
    <div className="pageHeader shrink-0 pb-2 text-white">
      <div
        className={`
          headerWrapper
          max-w-6xl mx-auto px-3 
          before:content-[''] before:absolute before:w-[100vw] before:h-12 before:left-0 before:bg-grey-35`}
      >
        <div className="headerContent flex gap-4 pt-3">
          <BackToStudio studio={session.session?.username} />
          <SpaceName />
          <div className="z-10 shrink-0 flex gap-4">
            {!session.session ? <Login /> : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const SpaceName = () => {
  return (
    <Popover className="w-full">
      {({ open }) => <SpaceNameContent open={open} />}
    </Popover>
  );
};

const SpaceNameContent = (props: { open: boolean }) => {
  let spaceName = useIndex.aev("this/name")[0];
  let [ref, { width }] = useMeasure();
  const [drawerRef, { height: innerHeight }] = useMeasure();

  let { minWidth, height } = useSpring({
    config: { mass: 0.1, tension: 500, friction: 25 },
    minWidth: props.open ? 256 : 0,
    height: props.open ? innerHeight : 0,
  });
  return (
    <animated.div
      style={{
        minWidth: minWidth,
      }}
      ref={ref}
      className={`headerSpaceName z-10 pt-1 font-bold grow pb-0.5 relative max-w-md`}
    >
      <animated.div
        style={{
          width,
        }}
        className={`border-accent-blue absolute rounded-md hover:border-2 hover:bg-bg-blue hover:text-accent-blue px-2 overflow-hidden ${
          props.open ? "bg-bg-blue text-accent-blue border-2" : "bg-grey-35"
        }`}
      >
        <Popover.Button
          as="div"
          className={`${
            props.open ? "" : "truncate"
          } font-bold outline-none hover:cursor-pointer`}
          style={{
            minWidth: props.open ? "240px" : undefined,
          }}
        >
          {spaceName?.value}
        </Popover.Button>
        <animated.div
          style={{
            height: height,
            overflow: "hidden",
          }}
        >
          <div ref={drawerRef} className="pb-2">
            <Settings />
          </div>
        </animated.div>
      </animated.div>
    </animated.div>
  );
};

const BackToStudio = (props: { studio?: string }) => {
  if (!props.studio) return <div className="shrink-0" />;

  return (
    <div className="shrink-0 z-10 headerBackToStudio">
      <Link href={`/s/${props.studio}`}>
        <div className="pt-1">
          <BackToStudioIcon />
        </div>
      </Link>
    </div>
  );
};

const Login = () => {
  let [logInOpen, setLogInOpen] = useState(false);
  return (
    <>
      <ButtonSecondary
        content="Log In"
        onClick={() => setLogInOpen(!logInOpen)}
      />

      <LogInModal isOpen={logInOpen} onClose={() => setLogInOpen(false)} />
    </>
  );
};

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;

const Settings = () => {
  let { session } = useAuth();
  let isMember = useIndex.ave("space/member", session.session?.studio);
  let smoker = useSmoker();
  const spaceID = useSpaceID();
  let { data: inviteLink } = useSWR(
    !isMember ? null : `${WORKER_URL}/space/${spaceID}/get_share_code`,
    async () => {
      if (!spaceID || !session.token) return;
      let code = await spaceAPI(
        `${WORKER_URL}/space/${spaceID}`,
        "get_share_code",
        {
          token: session.token,
        }
      );
      if (code.success) {
        return `${document.location.href}/join?code=${code.code}`;
      }
    }
  );

  const getShareLink = async (e: React.MouseEvent) => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    smoker({ position: { x: e.clientX, y: e.clientY }, text: "copied!" });
  };

  return (
    <div className="flex flex-col gap-2 pt-2">
      <Divider />
      <MembersModal />
      <ButtonSecondary
        onClick={(e) => getShareLink(e)}
        content={"Copy Invite Link"}
      />
      <input
        style={{ display: "none" }}
        className="grow"
        readOnly
        value={inviteLink}
        onClick={getShareLink}
      />
    </div>
  );
};

const MembersModal = () => {
  let [open, setOpen] = useState(false);
  let members = useIndex.aev("member/name");
  return (
    <>
      <ButtonSecondary content={"See Members"} onClick={() => setOpen(true)} />
      <Modal open={open} onClose={() => setOpen(false)}>
        <h2>Members</h2>
        <div className="flex flex-wrap gap-2 h-full">
          {members.map((m) => (
            <Link href={`/s/${encodeURIComponent(m.value)}`}>
              <div className="w-[160px]">
                <div className={`relative grow h-full memberCardBorder `}>
                  <BaseSmallCard isMember memberName={m.value} content="" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
};
