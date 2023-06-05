import { workerAPI } from "backend/lib/api";
import { useRouter } from "next/router";
import { shortcuts } from "hooks/useKeyboardHandling";
let WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL as string;
export default function IndexPage() {
  let router = useRouter();
  return (
    <div className="flex flex-col gap-2">
      <div
        onClick={async () => {
          let data = await workerAPI(WORKER_URL, "signup", {});
          router.push(`/s/${data.spaceID}`);
        }}
      >
        <button>create a space</button>
      </div>
      <Shortcuts />
    </div>
  );
}

const Shortcuts = () => {
  return (
    <div className="flex flex-col gap-4">
      <h1>Shortcuts</h1>
      <div className="flex flex-col gap-3">
        {shortcuts.map((s, index) => (
          <div className="flex flex-row gap-1" key={index}>
            <div>
              {s.ctrlKey ? (
                <>
                  <kbd>Ctrl</kbd> +{" "}
                </>
              ) : null}
              {s.shiftKey ? (
                <>
                  <kbd>Shift</kbd> +{" "}
                </>
              ) : null}
              <kbd>{s.key === " " ? "Space" : s.key}</kbd>:
            </div>
            {s.description}
          </div>
        ))}
      </div>
    </div>
  );
};
