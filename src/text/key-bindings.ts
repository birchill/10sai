import {
  hasCommandModifier,
  isCtrlKeyCommand,
  hasCommandModifierOnly,
  isCtrlKeyCommandOnly,
} from '../utils/keyboard';
import { isMac, isWindows } from '../utils/ua';

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
    case 'e':
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
