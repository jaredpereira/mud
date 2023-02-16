import { Dialog, Menu, Transition } from "@headlessui/react";
import React, { Fragment } from "react";

export const Divider = (props: { dark?: boolean }) => {
  return (
    <div
      className={`w-full border-t border-l ${
        props.dark ? `border-grey-55` : `border-grey-80`
      }`}
    ></div>
  );
};

export const FloatingContainer: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = (props) => {
  return (
    <div
      className={`
        rounded-md border
        border-grey-80 bg-white px-4 
        py-4
        shadow-drop
        ${props.className}
        `}
    >
      {props.children}
    </div>
  );
};

export const Modal: React.FC<
  React.PropsWithChildren<{ open: boolean; onClose: () => void }>
> = (props) => {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      className="fixed inset-0 z-10 overflow-y-hidden"
    >
      <Dialog.Overlay className="overlay" />
      <FloatingContainer
        className={`
              fixed top-1/2 left-1/2 grid max-h-[calc(100%-32px)]
              w-[calc(100%-32px)] max-w-md -translate-x-1/2
              -translate-y-1/2
              grid-flow-row
              gap-4
              overflow-auto
              `}
      >
        {props.children}
      </FloatingContainer>
    </Dialog>
  );
};

export const MenuContainer: React.FC<
  React.PropsWithChildren<{ className?: string }>
> = (props) => {
  return (
    <Transition
      as={Fragment}
      enter="transition ease-out duration-100"
      enterFrom="transform opacity-0 scale-95"
      enterTo="transform opacity-100 scale-100"
      leave="transition ease-in duration-75"
      leaveFrom="transform opacity-100 scale-100"
      leaveTo="transform opacity-0 scale-95"
    >
      <Menu.Items
        className={`
            absolute right-0 z-40 
            flex w-max 
            origin-top-right flex-col 
            justify-items-end rounded-md
            border 
            border-grey-80 
            bg-white 
            py-2 
            text-right
            shadow-drop
            ${props.className}`}
      >
        {props.children}
      </Menu.Items>
    </Transition>
  );
};

export const MenuItem: React.FC<
  React.PropsWithChildren<{
    onClick?: () => void;
    disabled?: boolean;
  }>
> = (props) => {
  return (
    <Menu.Item>
      {({ active }) => (
        <button
          className={`flex justify-end gap-2 px-3 py-1 text-right ${
            active ? "bg-bg-blue" : ""
          } ${
            props?.disabled
              ? "text-grey-80 line-through hover:bg-transparent"
              : ""
          }`}
          style={{ wordBreak: "break-word" }} //no tailwind equiv - need for long titles to wrap
          onClick={() => props.onClick?.()}
          disabled={props?.disabled}
        >
          {props.children}
        </button>
      )}
    </Menu.Item>
  );
};
