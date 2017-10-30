export function waitForDocLoad() {
  return new Promise(resolve => {
    if (document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('load', resolve);
    }
  });
}

export function waitForIdle() {
  return new Promise(resolve => {
    if (window.requestIdleCallback) {
      requestIdleCallback(resolve);
    } else {
      // I'm pretty sure by the time this app ever gets released all target
      // browsers will implemented requestIdleCallback. For now, though, just
      // fallback to rAF so that Edge doesn't break.
      requestAnimationFrame(resolve);
    }
  });
}
