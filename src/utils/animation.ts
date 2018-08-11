export const getFinishedPromise = (anim: Animation): Promise<Animation> => {
  if (anim.finished) {
    return anim.finished;
  }

  return new Promise((resolve, reject) => {
    /* XXX Upgrade to TS 3.0.1 and then use the following...
      anim.addEventListener(
        'finish',
        () => {
          resolve(anim);
        },
        { once: true }
      );
      anim.addEventListener(
        'cancel',
        () => {
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true }
      );
    */
    anim.onfinish = () => {
      resolve(anim);
    };
    anim.oncancel = () => {
      reject(new DOMException('Aborted', 'AbortError'));
    };
  });
};
