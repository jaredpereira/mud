import { Combobox, Dialog, Transition } from "@headlessui/react";
import { useIndex } from "hooks/useReplicache";
import { Card, Deck } from "components/Icons";
import { useState } from "react";

export const FindOrCreateCard = (props: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onSelect: (
    id: { entity: string; type: "existing" } | { name: string; type: "create" }
  ) => void;
}) => {
  let [input, setInput] = useState("");
  let decks = useIndex.aev("deck");
  let titles = useIndex.aev("card/title");
  let items = titles
    .filter((f) => {
      if (/[A-Z]/g.test(input)) return f.value.includes(input);
      return f.value.toLocaleLowerCase().includes(input.toLocaleLowerCase());
    })
    .map((t) => {
      return {
        name: t.value,
        entity: t.entity,
        isDeck: !!decks.find((d) => d.entity === t.entity),
      };
    });
  let inputExists = !!items.find(
    (i) => i.name.toLocaleLowerCase() === input.toLocaleLowerCase()
  );
  return (
    <Transition show={props.open}>
      <Dialog
        onClose={props.onClose}
        className="fixed z-10 inset-0 overflow-y-hidden"
      >
        <Dialog.Overlay className="fixed inset-0 bg-grey-90 opacity-30" />
        <div className="flex items-center justify-center min-h-screen">
          <div className="relative w-[80vw] min-w-[384px] mx-auto">
            <Combobox
              value=""
              onChange={(c) => {
                if (c === "create")
                  props.onSelect({ name: input, type: "create" });
                else props.onSelect({ entity: c, type: "existing" });
              }}
              as="div"
              className="relative z-10 w-full"
            >
              <Combobox.Input
                value={input}
                className="w-full p-2 rounded-md border-grey-55 border"
                placeholder="search or create"
                onChange={(e) => setInput(e.currentTarget.value)}
              />
              <Combobox.Options
                static
                className="w-full py-4 flex-col flex gap-2 bg-white mt-2 mb-8 rounded-md h-[80vh] overflow-y-auto shadow-drop"
              >
                {inputExists ? null : (
                  <Combobox.Option key={"create"} value={"create"}>
                    {({ active }) => {
                      return (
                        <SearchItem active={active}>
                          <div className="px-2 p-1.5 border-2 border-b-accent-blue rounded-md text-accent-blue font-bold w-full bg-white">
                            {!input
                              ? "Create a blank card"
                              : `Create "${input}"`}
                          </div>
                        </SearchItem>
                      );
                    }}
                  </Combobox.Option>
                )}
                {items.map((item) => {
                  return (
                    <Combobox.Option key={item.entity} value={item.entity}>
                      {({ active }) => {
                        return (
                          <SearchItem active={active}>
                            <div
                              className={`flex flex-row gap-2 items-center ${
                                props.selected.includes(item.entity)
                                  ? "bg-test-pink"
                                  : ""
                              }`}
                            >
                              {item.isDeck ? <Deck /> : <Card />}
                              {item.name}
                            </div>
                          </SearchItem>
                        );
                      }}
                    </Combobox.Option>
                  );
                })}
              </Combobox.Options>
            </Combobox>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

const SearchItem: React.FC<{
  active: boolean;
  className?: string;
}> = (props) => {
  return (
    <div
      className={`w-full px-3 py-0.5 ${props.className || ""} ${
        props.active ? "bg-bg-blue" : ""
      }`}
    >
      {props.children}
    </div>
  );
};
