import * as React from 'react';

import { AnchoredSpeechBubble } from './AnchoredSpeechBubble';
import { MenuList, MenuListInterface } from './MenuList';

interface Props {
  id?: string;
  className?: string;
  children: React.ReactNode;
}

interface MenuState {
  isOpen: boolean;
  toggledByKeyboard: boolean;
}

export const MenuButton: React.FC<Props> = props => {
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuListRef = React.useRef<MenuListInterface>(null);

  let className = 'menu-button';
  if (props.className) {
    className += ' ' + props.className;
  }

  const [menuState, setMenuState] = React.useState<MenuState>({
    isOpen: false,
    toggledByKeyboard: false,
  });

  // Clicking the button
  const onClick = React.useCallback(
    (evt: React.MouseEvent<HTMLButtonElement>) => {
      setMenuState({
        isOpen: !menuState.isOpen,
        toggledByKeyboard: evt.screenX === 0 && evt.screenY === 0,
      });
    },
    [menuState.isOpen]
  );

  // Clicking outside the menu
  const onClickOutside = React.useCallback(() => {
    setMenuState({
      isOpen: !menuState.isOpen,
      toggledByKeyboard: false,
    });
  }, [menuState.isOpen]);

  // Keypresses while the button is focussed
  const onKeyDown = React.useCallback(
    (evt: React.KeyboardEvent<HTMLButtonElement>) => {
      switch (evt.key) {
        case 'ArrowDown':
        case 'Home':
          if (menuState.isOpen && menuListRef.current) {
            menuListRef.current.focus();
            evt.preventDefault();
          }
          break;

        case 'ArrowUp':
        case 'End':
          if (menuState.isOpen && menuListRef.current) {
            menuListRef.current.focusEnd();
            evt.preventDefault();
          }
          break;

        case 'Escape':
          if (menuState.isOpen) {
            setMenuState({ isOpen: false, toggledByKeyboard: true });
            evt.preventDefault();
          }
          break;
      }
    },
    [menuState.isOpen, menuListRef.current]
  );

  // Unhandled keypresses while the menu is focussed
  const onUnhandledKeyPress = React.useCallback(
    (evt: React.KeyboardEvent<{}>) => {
      if (evt.key === 'Escape') {
        setMenuState({ isOpen: false, toggledByKeyboard: true });
        evt.preventDefault();
      }

      // Prevent tabbing out of the menu
      //
      // We currently don't allow this because the SpeechBubble used for the
      // menu is added to a separate layer in a completely different part of the
      // DOM. This isn't great, so ultimately we should either:
      //
      // a) Manually manage the prev/next focus (e.g. using tabIndex), or
      //
      // b) Rework SpeechBubble so we can put it in the correct part of the DOM.
      //
      // In either case we will want to add an onBlur handler to MenuList that
      // takes care to close the menu when we tab out of it (the onBlur handler
      // defined below should work fine for this).
      if (evt.key === 'Tab' && !evt.defaultPrevented) {
        evt.preventDefault();
      }
    },
    [menuState.isOpen]
  );

  // Focus the first item when the menu is triggered by keyboard
  React.useLayoutEffect(() => {
    if (
      menuState.isOpen &&
      menuState.toggledByKeyboard &&
      menuListRef.current
    ) {
      menuListRef.current.focus();
    }
  }, [menuState.isOpen, menuListRef.current]);

  // If the menu button loses focus, but not to the menu content, close the
  // menu.
  const onBlur = React.useCallback(
    (evt: React.FocusEvent<{}>) => {
      if (
        buttonRef.current &&
        buttonRef.current.contains(evt.relatedTarget as Node)
      ) {
        return;
      }

      if (
        menuListRef.current &&
        menuListRef.current.contains(evt.relatedTarget as Node)
      ) {
        return;
      }

      // It doesn't matter what we set toggledByKeyboard to. It's only used when
      // opening the menu.
      setMenuState({ isOpen: false, toggledByKeyboard: false });
    },
    [buttonRef.current, menuListRef.current]
  );

  // Automatically close the menu when the screen changes.
  React.useEffect(() => {
    if (!menuState.isOpen) {
      return;
    }

    const callback = (mutations: Array<MutationRecord>) => {
      for (const mutation of mutations) {
        if (mutation.type !== 'attributes') {
          continue;
        }

        const attributeValue = (mutation.target as Element).getAttribute(
          mutation.attributeName!
        );

        let isHidden = false;
        switch (mutation.attributeName) {
          case 'aria-hidden':
            isHidden = attributeValue === 'true';
            break;

          case 'hidden':
            isHidden = attributeValue === '';
            break;
        }
        if (!isHidden) {
          return;
        }

        const isAncestor =
          buttonRef.current &&
          (mutation.target as Element).contains(buttonRef.current);
        if (!isAncestor) {
          return;
        }

        setMenuState({ isOpen: false, toggledByKeyboard: false });
      }
    };

    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributeFilter: ['hidden', 'aria-hidden'],
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [menuState.isOpen, buttonRef.current]);

  return (
    <>
      <button
        className={className}
        type="button"
        title="Menu"
        ref={buttonRef}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        aria-expanded={menuState.isOpen}
        aria-haspopup="menu"
        aria-controls={props.id}
      >
        Menu
      </button>
      <AnchoredSpeechBubble
        className="menu"
        position="below"
        align="center"
        anchorElement={buttonRef.current}
        visible={menuState.isOpen}
        onClickOutside={onClickOutside}
        onUnhandledKeyPress={onUnhandledKeyPress}
      >
        <MenuList id={props.id} ref={menuListRef}>
          {props.children}
        </MenuList>
      </AnchoredSpeechBubble>
    </>
  );
};
