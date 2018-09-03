import UAParser from 'ua-parser-js';

const parser = new UAParser();
const os = parser.getOS();

const isWindows = os.name === 'Windows';
const isMac = os.name === 'Mac OS';

// Draft-js recommends using the default key bindings but we don't because:
//
// - They are not strict enough (e.g. treating Ctrl+Shift+B as Bold)
// - They permit commands we don't ever expect to support (e.g. Ctrl+J for
//   'code')
// - They have cruft we don't need (e.g. Firefox pre-29 support)
// - We don't control them so they might add new commands at any point that
//   could break us unless we carefully audit each update of draft-js.
//
// That said, there is some good stuff there so we should basically just fork it
// and will need to check occasionally for any useful updates to it.
//
// For what it's worth, this current version is based on Draft 0.10.24 so any
// bug fixes to the default keybindings since then should possibly be added
// here.

const isCtrlKeyCommand = (e: React.KeyboardEvent<{}>): boolean => {
  // As per draft-js, we need to check that the ctrlKey modifier is not being
  // used since if they are, the result is an `altGraph` key modifier.
  return !!e.ctrlKey && !e.altKey;
};

const isCtrlKeyCommandOnly = (e: React.KeyboardEvent<{}>): boolean => {
  // As with isCtrlKeyCommand but also check that Shift is NOT being uesd since
  // that has been known to conflict with browser UI shortcuts (e.g.
  // Ctrl+Shift+B to open bookmarks).
  return !!e.ctrlKey && !e.altKey && !e.shiftKey;
};

const hasCommandModifier = (e: React.KeyboardEvent<{}>): boolean => {
  return isMac ? !!e.metaKey && !e.altKey : isCtrlKeyCommand(e);
};

const hasCommandModifierOnly = (e: React.KeyboardEvent<{}>): boolean => {
  // Likewise, we also check that Shift is NOT being used here.
  return isMac
    ? !!e.metaKey && !e.altKey && !e.shiftKey
    : isCtrlKeyCommandOnly(e);
};

const getZCommand = (e: React.KeyboardEvent<{}>): string | null => {
  if (!hasCommandModifier(e)) {
    return null;
  }
  return e.shiftKey ? 'redo' : 'undo';
};

const shouldRemoveWord = (e: React.KeyboardEvent<{}>): boolean => {
  return (isMac && e.altKey) || isCtrlKeyCommand(e);
};

const getDeleteCommand = (e: React.KeyboardEvent<{}>): string | null => {
  // Allow default "cut" behavior for Windows on Shift + Delete.
  if (isWindows && e.shiftKey) {
    return null;
  }
  return shouldRemoveWord(e) ? 'delete-word' : 'delete';
};

const getBackspaceCommand = (e: React.KeyboardEvent<{}>): string | null => {
  if (hasCommandModifier(e) && isMac) {
    return 'backspace-to-start-of-line';
  }
  return shouldRemoveWord(e) ? 'backspace-word' : 'backspace';
};

export function cardKeyBindings(e: React.KeyboardEvent<{}>): string | null {
  switch (e.key) {
    case 'b':
      return hasCommandModifierOnly(e) ? 'bold' : null;
    case 'i':
      return hasCommandModifierOnly(e) ? 'italic' : null;
    case 'u':
      return hasCommandModifierOnly(e) ? 'underline' : null;
    case 'k':
      return !isWindows && isCtrlKeyCommandOnly(e) ? 'secondary-cut' : null;
    case 't':
      return isMac && isCtrlKeyCommandOnly(e) ? 'transpose-characters' : null;
    case 'w':
      return isMac && isCtrlKeyCommandOnly(e) ? 'backspace-word' : null;
    case 'y':
      if (isCtrlKeyCommandOnly(e)) {
        return isWindows ? 'redo' : 'secondary-paste';
      }
      return null;
    case 'z':
      return getZCommand(e) || null;
    case '.':
      return hasCommandModifierOnly(e) ? 'emphasis' : null;
    case 'Enter':
      return 'split-block';
    case 'Delete':
      return getDeleteCommand(e);
    case 'Backspace':
      return getBackspaceCommand(e);
    // Draft also has:
    // Ctrl+D = 'delete' (Seems to be a Windows thing, but seriously, who uses
    //          this?)
    // Ctrl+H = 'backspace'
    // Ctrl+M = 'split-block'
    // Ctrl+O = 'split-block'
    default:
      return null;
  }
}

export default cardKeyBindings;
