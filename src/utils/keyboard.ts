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
