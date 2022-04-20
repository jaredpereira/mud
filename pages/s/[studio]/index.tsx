import { spaceAPI, workerAPI } from "backend/lib/api";
import { ButtonSecondary, ButtonLink } from "components/Buttons";
import { SpaceProvider } from "components/ReplicacheProvider";
import { SpaceList } from "components/SpacesList";
import { useAuth } from "hooks/useAuth";
import { ReplicacheContext, useIndex } from "hooks/useReplicache";
import { useRouter } from "next/router";
import { useContext, useState } from "react";
import useSWR from "swr";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
export default function StudioPage() {
  let router = useRouter();
  let { data: id } = useSWR(
    "/space/" + router.query.studio,
    () => {
      let id = workerAPI(WORKER_URL, "get_studio", {
        name: router.query.studio as string,
      });
      return id;
    },
    { revalidateOnFocus: false }
  );
  if (!id) return <div> loading</div>;
  if (!id.success) return <div>404 studio</div>;
  return (
    <SpaceProvider id={id.id}>
      <div className="pt-4 px-4">
        <div className="flex justify-between pb-4">
          <StudioName />
          <Logout />
        </div>
        <CreateSpace spaceID={id.id} />
        <SpaceList />
      </div>
    </SpaceProvider>
  );
}

const StudioName = () => {
  let name = useIndex.ave("this/name", "");
  return <div>{name ? name?.value : "Generic Studio Name!"}</div>;
};

const CreateSpace = (props: { spaceID: string }) => {
  let [name, setName] = useState("");
  let auth = useAuth();
  let rep = useContext(ReplicacheContext);
  if (!auth.session.loggedIn) return null;
  return (
    <div className="pb-4 flex">
      <input
        className="mr-2"
        value={name}
        placeholder="new space"
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <ButtonSecondary
        content="create"
        onClick={async () => {
          if (!auth.session.loggedIn || !name) return;
          await spaceAPI(
            `${WORKER_URL}/space/${props.spaceID}`,
            "create_space",
            {
              name,
              token: auth.session.token,
            }
          );
          setName("");
          rep?.rep.pull();
        }}
      />
    </div>
  );
};

const Logout = () => {
  let { session, logout } = useAuth();
  let router = useRouter();
  return session.session?.username === router.query.studio ? (
    <div className="self-center">
      <ButtonLink content="logout" onClick={() => logout()} />
    </div>
  ) : null;
};
