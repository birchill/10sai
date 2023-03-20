// This helper
//
// - Adds some missing typings for requestIdleCallback
// - Adds a polyfill for browsers that don't support requestIdleCallback
// - Adds a polyfill for non-Window contexts (e.g. workers)
// - Provides a Promise wrapper

interface IdleDeadline {
  timeRemaining: () => number;
  readonly didTimeout: boolean;
}

interface IdleRequestOptions {
  timeout: number;
}

type IdleCallbackHandle = ReturnType<typeof setTimeout> | number;

type IdleRequestCallback = (deadline: IdleDeadline) => void;

export let requestIdleCallback: (
  callback: IdleRequestCallback,
  options?: IdleRequestOptions
) => IdleCallbackHandle;
export let cancelIdleCallback: (handle: IdleCallbackHandle) => void;

if (
  typeof self === 'object' &&
  self.requestIdleCallback &&
  self.cancelIdleCallback
) {
  requestIdleCallback = self.requestIdleCallback;
  cancelIdleCallback = self.cancelIdleCallback;
} else {
  requestIdleCallback = (
    callback: IdleRequestCallback,
    options: IdleRequestOptions
  ): IdleCallbackHandle => {
    // Use half the specified timeout since it probably represents a worst-case
    // scenario.
    const timeout = options ? options.timeout / 2 : 0;
    return setTimeout(() => {
      callback({ timeRemaining: () => 0, didTimeout: true });
    }, timeout);
  };

  cancelIdleCallback = (handle: IdleCallbackHandle) => {
    clearTimeout(handle as ReturnType<typeof setTimeout>);
  };
}

export function requestIdleCallbackPromise(
  options?: IdleRequestOptions
): Promise<void> {
  return new Promise((resolve) =>
    requestIdleCallback(() => {
      resolve();
    }, options)
  );
}
