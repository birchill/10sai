export function waitForEvents(cycles = 1) {
  return new Promise(resolve => {
    (function wait() {
      if (--cycles) {
        setTimeout(wait, 0);
      } else {
        setImmediate(resolve);
      }
    }());
  });
}

export default waitForEvents;
