import { url } from "inspector";

type SVGProps = JSX.IntrinsicElements["svg"];
export const Gripper = (props: SVGProps) => {
  return (
    <svg width="6" height="100%" className="min-h-2" {...props}>
      <pattern
        id="gripper"
        x="0"
        y="0"
        viewBox="0 0 6 4"
        width="6"
        height="4"
        patternUnits="userSpaceOnUse"
      >
        <rect width="2" height="2" rx="1" fill="currentColor" />
        <rect x="4" width="2" height="2" rx="1" fill="currentColor" />
      </pattern>
      <rect x="0" y="0" width="6" height="100%" fill="url(#gripper)" />
    </svg>
  );
};

export const GripperBG = (props: JSX.IntrinsicElements["div"]) => {
  return (
    <div
      {...props}
      className="h-full w-[6px] mask-repeat mask-repeat-[no-repeat_space]  bg-grey-80 hover:bg-grey-55"
      style={{ maskImage: "url(/img/gripper.svg)" }}
    ></div>
  );
};
