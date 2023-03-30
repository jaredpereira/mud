import { useSupabaseClient } from "@supabase/auth-helpers-react";
import { workerAPI } from "backend/lib/api";
import { ButtonPrimary } from "components/Buttons";
import { DotLoader } from "components/DotLoader";
import { useAuth } from "hooks/useAuth";
import { useDebouncedEffect } from "hooks/utils";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
export default function SignupPage() {
  let router = useRouter();
  let supabase = useSupabaseClient();
  let [status, setStatus] = useState<
    "valid" | "invalidUsername" | "complete" | "loading"
  >("valid");
  let [data, setData] = useState({
    username: "",
  });

  useDebouncedEffect(
    async () => {
      let { data: existingUsername } = await supabase
        .from("identity_data")
        .select("username")
        .eq("username", data.username)
        .single();
      setStatus((previousStatus) => {
        if (previousStatus !== "valid" && previousStatus !== "invalidUsername")
          return previousStatus;
        if (existingUsername) return "invalidUsername";
        return "valid";
      });
    },
    300,
    [data.username]
  );

  let { authToken: tokens, session } = useAuth();
  useEffect(() => {
    if (session.loggedIn) {
      if (!session?.session?.username) router.push("/setup");
      else router.push(`/s/${session?.session?.username}`);
    }
  }, [session, router]);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokens) return;
    setStatus("loading");
    let res = await workerAPI(WORKER_URL, "signup", {
      username: data.username,
      tokens,
    });
    if (!res.success) {
      if (res.error === "username already exists") setStatus("invalidUsername");
      if (res.error === "user already initialized") {
        router.push(`/s/${data.username}`);
      }
    }
    if (res.success) {
      let { data } = await supabase.auth.refreshSession();
      if (data.session) {
        await supabase.auth.setSession(data?.session);
        router.push(`/s/${data.user?.user_metadata.username}`);
      }
      setStatus("complete");
    }
  };

  if (!tokens)
    return (
      <div className="grid-rows-max mx-auto grid max-w-md gap-4">
        <h1>Set up your Studio!</h1>
        <p>
          To continue,{" "}
          <Link className="text-accent-blue" href="/signup">
            sign up
          </Link>{" "}
          or{" "}
          <Link className="text-accent-blue" href="/login">
            log in
          </Link>
        </p>
      </div>
    );

  return (
    <div className="grid-rows-max mx-auto grid max-w-md gap-4">
      <div className="grid-auto-rows grid gap-2">
        <h1>Set up your Studio</h1>
      </div>

      <form onSubmit={onSubmit} className="grid w-full gap-4">
        {status === "invalidUsername" ? (
          <div className="text-accent-red">
            <span>Sorry, that username is not available</span>
          </div>
        ) : null}
        <p>
          Pick a name for your Studio — your Hyperlink homepage, where all your
          Spaces will live.
        </p>
        <label className="grid-flow-rows grid gap-2 font-bold">
          <span>
            Username{" "}
            <span className="text-sm font-normal">
              (numbers, letters, and underscores only)
            </span>
          </span>
          <input
            type="text"
            pattern="[A-Za-z_0-9]+"
            value={data.username}
            onChange={(e) =>
              setData({ ...data, username: e.currentTarget.value })
            }
          />
        </label>
        <ButtonPrimary
          disabled={
            status === "invalidUsername" ||
            data.username.match(/^[A-Za-z_0-9]+$/) === null
          }
          type="submit"
          content={
            status === "loading" ? <DotLoader /> : "Construct your Studio!"
          }
        />
      </form>
    </div>
  );
}