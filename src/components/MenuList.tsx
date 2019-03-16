import * as React from 'react';
import { focusableSelector } from '../utils/focus';

interface Props {
  id?: string;
  children: React.ReactNode;
}

interface Focusable extends Element {
  focus(): void;
}

export interface MenuListInterface {
  focus: () => void;
}

const MenuListImpl: React.FC<Props> = (props, ref) => {
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useImperativeHandle(ref, () => ({
    focus: () => {
      if (!wrapperRef.current) {
        return;
      }

      const firstItem = wrapperRef.current.querySelector(
        focusableSelector
      ) as Focusable | null;
      if (firstItem) {
        firstItem.focus();
      }
    },
  }));

  const onKeyDown = (evt: React.KeyboardEvent<HTMLDivElement>) => {
    if (!evt.target || !(evt.target instanceof HTMLElement)) {
      return;
    }

    if (
      !wrapperRef.current ||
      !wrapperRef.current!.contains(evt.target.ownerDocument!.activeElement)
    ) {
      return;
    }

    const getTabList = () =>
      Array.from(
        wrapperRef.current!.querySelectorAll(focusableSelector)
      ) as Array<Focusable>;

    switch (evt.key) {
      case 'ArrowUp':
      case 'ArrowDown':
        {
          const tabList = getTabList();
          const currentElement = evt.target.ownerDocument!.activeElement;
          const currentIndex = tabList.indexOf(currentElement as Focusable);
          if (currentIndex !== -1) {
            let nextIndex;
            if (evt.key === 'ArrowDown') {
              nextIndex =
                currentIndex === tabList.length - 1 ? 0 : currentIndex + 1;
            } else {
              nextIndex =
                currentIndex === 0 ? tabList.length - 1 : currentIndex - 1;
            }
            tabList[nextIndex].focus();
            evt.preventDefault();
          }
        }
        break;

      case 'Home':
        {
          const firstItem = wrapperRef.current.querySelector(
            focusableSelector
          ) as Focusable | null;
          if (firstItem) {
            firstItem.focus();
            evt.preventDefault();
          }
        }
        break;

      case 'End':
        {
          const tabList = getTabList();
          if (tabList.length) {
            tabList[tabList.length - 1].focus();
            evt.preventDefault();
          }
        }
        break;
    }
  };

  return (
    <div
      role="menu"
      id={props.id}
      className="menu-list"
      ref={wrapperRef}
      onKeyDown={onKeyDown}
    >
      {props.children}
    </div>
  );
};

export const MenuList = React.forwardRef<MenuListInterface, Props>(
  MenuListImpl
);
