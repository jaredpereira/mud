import React, { forwardRef, useCallback } from "react";
import Linkify from "linkify-react";
import { parseLine } from "src/parseMarkdownLine";
import { useUIState } from "hooks/useUIState";
import { useMutations } from "hooks/useReplicache";
import { scanIndex } from "src/replicache";

export const RenderedText = forwardRef<
  HTMLPreElement,
  { text: string; renderLinks?: boolean } & JSX.IntrinsicElements["pre"]
>((props, ref) => {
  let { rep } = useMutations();
  let openLink = useCallback(
    async (link: string) => {
      if (!rep) return;
      let block = await rep.query((tx) =>
        scanIndex(tx).ave("block/unique-name", link.slice(2, -2))
      );
      if (block) {
        let entity = block.entity;
        let path = await rep.query(async (tx) => {
          let path = [];
          let current = entity;
          while (current) {
            let parent = await scanIndex(tx).eav(current, "block/parent");
            if (!parent) break;
            path.push(parent.value.value);
            current = parent.value.value;
          }
          return path;
        });
        let state = useUIState.getState();
        if (state.root && !path.includes(state.root)) {
          state.setRoot(undefined);
        }
        useUIState.setState((s) => ({
          s,
          openStates: {
            ...s.openStates,
            ...Object.fromEntries(path.map((p) => [p, true])),
          },
        }));
        state.setFocused(block.entity);
      }
    },
    [rep]
  );
  let parseConfig = {
    renderLinks: true,
    openLink,
  };
  return (
    <Linkify options={{ className: "text-accent-blue underline" }}>
      <pre
        role="link"
        ref={ref}
        {...props}
        className={`${props.className} break-words`}
        style={{
          ...props.style,
          wordBreak: "break-word", //this works better than tailwind 'break-words' for some reason!
        }}
      >
        {props.text ? (
          // One day we should do proper parsing but for now a line-based approach works
          // great
          props.text.split("\n").map((t, key) => {
            if (t.startsWith("###"))
              return (
                <p className="text-grey-35 underline" key={key}>
                  {parseLine(t, parseConfig)}
                </p>
              );
            if (t.startsWith("##"))
              return (
                <p className="font-bold text-grey-35" key={key}>
                  {parseLine(t, parseConfig)}
                </p>
              );
            if (t.startsWith("#"))
              return (
                <p className="font-bold underline decoration-2 " key={key}>
                  {parseLine(t, parseConfig)}
                </p>
              );
            if (t.match(/^[0-9]+\./)) {
              let [num, ...rest] = t.split(" ");
              return (
                <p className="" key={key}>
                  <strong>{num}</strong>{" "}
                  {parseLine(rest.join(" "), parseConfig)}
                </p>
              );
            }
            if (t.startsWith("-"))
              return (
                <p key={key}>
                  <strong>-</strong>
                  {parseLine(t.slice(1), parseConfig)}
                </p>
              );

            return <p key={key}>{parseLine(t, parseConfig)}</p>;
          })
        ) : (
          <span className="block w-full italic !text-grey-80">
            {props.placeholder}
          </span>
        )}
      </pre>
    </Linkify>
  );
});

RenderedText.displayName = "RenderedText";
