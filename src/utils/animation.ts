export const getFinishedPromise = (anim: Animation): Promise<Animation> => {
  if (anim.finished) {
    return anim.finished;
  }

  return new Promise((resolve, reject) => {
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
  });
};
