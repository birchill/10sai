export function waitForDocLoad() {
  return new Promise<void>((resolve) => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', () => resolve());
    }
  });
}

type IdleRequestCallback = (deadline: IdleDeadline) => void;

declare global {
  interface IdleDeadline {
    timeRemaining: () => number;
    readonly didTimeout: boolean;
  }

  interface Window {
    requestIdleCallback: (
      callback: IdleRequestCallback,
      options?: IdleRequestOptions
    ) => number;
    cancelIdleCallback: (handle: number) => void;
  }
}

export function waitForIdle() {
  return new Promise((resolve) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(resolve);
    } else {
      // I'm pretty sure by the time this app ever gets released all target
      // browsers will implemented requestIdleCallback. For now, though, just
      // fallback to rAF so that Edge doesn't break.
      requestAnimationFrame(resolve);
    }
  });
}

// Ported and simplified from underscore.js
export function debounce(func: Function, wait: number) {
  let timeout: number | null;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeout as number);
    timeout = window.setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}
