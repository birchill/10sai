export function waitForEvents() {
  return new Promise(resolve => {
    setImmediate(resolve);
  });
}
