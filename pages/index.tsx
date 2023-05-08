import { workerAPI } from "backend/lib/api";
import { useRouter } from "next/router";
let WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
export default function IndexPage() {
  let router = useRouter();
  return (
    <div
      onClick={async () => {
        let data = await workerAPI(WORKER_URL, "signup", {});
        router.push(`/s/${data.spaceID}`);
      }}
    >
      <button>create a space</button>
    </div>
  );
}
