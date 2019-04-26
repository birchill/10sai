import { isMac } from './ua';

// Draft-js recommends using the default key bindings but we don't because:
//
// - They are not strict enough (e.g. treating Ctrl+Shift+B as Bold)
// - They permit commands we don't ever expect to support (e.g. Ctrl+J for
//   'code')
// - They have cruft we don't need (e.g. Firefox pre-29 support)
// - We don't control them so they might add new commands at any point that
//   could break us unless we carefully audit each update of draft-js.
//
// That said, there is some good stuff there so we basically just fork it
// and will need to check occasionally for any useful updates to it.
//
// For what it's worth, this current version is based on Draft 0.10.24 so any
// bug fixes to the default keybindings since then should possibly be added
// here.

export const isCtrlKeyCommand = (
  e: React.KeyboardEvent<{}> | KeyboardEvent
): boolean => {
  // As per draft-js, we need to check that the altKey modifier is not being
  // used since if they are, the result is an `altGraph` key modifier.
  return !!e.ctrlKey && !e.altKey;
};

export const isCtrlKeyCommandOnly = (
  e: React.KeyboardEvent<{}> | KeyboardEvent
): boolean => {
  // As with isCtrlKeyCommand but also check that Shift is NOT being used since
  // that has been known to conflict with browser UI shortcuts (e.g.
  // Ctrl+Shift+B to open bookmarks).
  return !!e.ctrlKey && !e.altKey && !e.shiftKey;
};

export const hasCommandModifier = (
  e: React.KeyboardEvent<{}> | KeyboardEvent
): boolean => {
  return isMac ? !!e.metaKey && !e.altKey : isCtrlKeyCommand(e);
};

export const hasCommandModifierOnly = (
  e: React.KeyboardEvent<{}> | KeyboardEvent
): boolean => {
  // Likewise, we also check that Shift is NOT being used here.
  return isMac
    ? !!e.metaKey && !e.altKey && !e.shiftKey
    : isCtrlKeyCommandOnly(e);
};

export const hasAllTheKeys = (e: React.KeyboardEvent<{}>): boolean =>
  (isMac ? !!e.metaKey : !!e.ctrlKey) && e.altKey && e.shiftKey;

export const hasNoModifiers = (
  e: React.KeyboardEvent<{}> | KeyboardEvent
): boolean => !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// We only want to show shortcut keys if the user has a physical keyboard.
// However, there's no way of doing that yet:
//
//   https://github.com/w3c/csswg-drafts/issues/3871
//
// One approach we _could_ try is to see if we are a mobile touchscreen device,
// and if we're NOT, assume we have a keyboard.
//
// Browsers pretend they don't support touch events for touchscreen desktops
// when you use certain legacy touch event handlers to feature detect. See:
//
//   https://groups.google.com/a/chromium.org/forum/#!msg/blink-dev/KV6kqDJpYiE/YFM28ZNBBAAJ
//   https://bugzilla.mozilla.org/show_bug.cgi?id=1412485
//   https://github.com/w3c/touch-events/issues/64
//
// So we could exploit that to filter out touchscreen mobile devices. However,
// that's not going to work properly for feature phones like KaiOS that are
// mobile but don't have a proper keyboard.
//
// Instead, we test for a mouse-like device, and if we have one, assume we also
// have a keyboard. It's not right, but it should work for most devices until
// the CSSWG gets around to speccing something for this.
//
// This approach also happens to work when we enable touch simulation (and
// reload) in Firefox DevTools.
export const hasPhysicalKeyboard = window.matchMedia(
  '(hover: hover) and (pointer: fine)'
).matches;

// Test if an object is some sort of editable element.
//
// If we are listening for keyboard shortcuts on some element high up the DOM
// tree we want to ignore any keystrokes that occur on regular text boxes.
export const isTextBox = (elem: any) => {
  if (!(elem instanceof HTMLElement)) {
    return false;
  }

  // We treat all <input> elements as text boxes since even those ones that
  // aren't normally text boxes could, on some platforms, accept key
  // strokes (e.g. type="color" may be a textbox on platforms that don't
  // have a picker, or might allow textentry for inputting hex codes).
  if (elem.tagName === 'TEXTAREA' || elem.tagName === 'INPUT') {
    return true;
  }

  // Treat <select> as a textbox since you can often type to select an entry
  // and we don't want to catch that.
  if (elem.tagName === 'SELECT') {
    return true;
  }

  if (elem.isContentEditable) {
    return true;
  }

  return false;
};

export const localizeShortcut = (shortcut: string): string => {
  if (!isMac) {
    return shortcut;
  }

  return shortcut
    .split('+')
    .map(part => {
      switch (part) {
        case 'Ctrl':
          return '\u2318';
        case 'Alt':
          return '\u2325';
        case 'Shift':
          return '\u21e7';
        case 'MacCtrl':
          return '\u2303';
        default:
          return part;
      }
    })
    .sort((a: string, b: string) => {
      const order = (key: string): number => {
        switch (key) {
          case 'Fn':
            return 0;
          case '\u2303':
            return 1;
          case '\u2325':
            return 2;
          case '\u21e7':
            return 3;
          case '\u2318':
            return 4;
          default:
            return 10;
        }
      };
      return order(a) - order(b);
    })
    .join('');
};
