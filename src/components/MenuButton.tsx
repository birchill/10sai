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
    [menuState.isOpen]
  );

  // Unhandled keypresses while the menu is focussed
  const onUnhandledKeyPress = React.useCallback(
    (evt: React.KeyboardEvent<{}>) => {
      if (evt.key === 'Escape') {
        setMenuState({ isOpen: false, toggledByKeyboard: true });
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
  }, [menuState.isOpen]);

  return (
    <>
      <button
        className={className}
        type="button"
        title="Menu"
        ref={buttonRef}
        onClick={onClick}
        onKeyDown={onKeyDown}
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
