import * as React from 'react';
import { debounce } from '../utils';

export interface KeyboardFocusHelperCallbacks {
  onKeyDown?: (e: React.KeyboardEvent<{}>) => void;
  onFocus?: (e: React.FocusEvent<{}> & { wasKeyboard: boolean }) => void;
}

// Utility class that augments focus events with a 'wasKeyboard' param.
export class KeyboardFocusHelper {
  private gotTab: boolean = false;
  private debouncedClearGotTab: () => void;
  private callbacks: KeyboardFocusHelperCallbacks;

  constructor(callbacks: KeyboardFocusHelperCallbacks = {}) {
    this.callbacks = callbacks;
    this.debouncedClearGotTab = debounce(() => {
      this.gotTab = false;
    }, 100);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onFocus = this.onFocus.bind(this);
  }

  onKeyDown(e: React.KeyboardEvent<{}>) {
    if (e.key === 'Tab') {
      this.gotTab = true;
      this.debouncedClearGotTab();
    }

    this.callbacks.onKeyDown && this.callbacks.onKeyDown(e);
  }

  onFocus(e: React.FocusEvent<{}>) {
    this.callbacks.onFocus &&
      this.callbacks.onFocus({ ...e, wasKeyboard: this.gotTab });
  }
}
