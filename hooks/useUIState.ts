import { create } from "zustand";
export let useUIState = create<{
  mode: "edit" | "normal";
  focused: undefined | string;
  focusMode: boolean;
  setFocused: (entity: string | undefined) => void;
}>((set) => ({
  mode: "normal",
  focusMode: true,
  focused: undefined,
  setFocused: (id: string | undefined) => set({ focused: id }),
}));
