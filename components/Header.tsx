import { useUIState } from "hooks/useUIState";
export const Header = () => {
  let focusMode = useUIState((s) => s.focusMode);
  return (
    <>
      <div className="h-6" />
      <div
        className="fixed z-10 m-auto flex h-6 w-full flex-row justify-end gap-2 border-b bg-background px-8"
        style={{ top: 0, left: 0 }}
      >
        <button
          className={`text-sm ${focusMode ? "underline" : ""}`}
          onClick={() => {
            useUIState.setState((s) => ({ focusMode: !s.focusMode }));
          }}
        >
          focus
        </button>
      </div>
    </>
  );
};
