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
