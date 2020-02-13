// Based on https://github.com/yixizhang/seed-shuffle/blob/master/index.js
// (Public Domain)

export function shuffleWithSeed<T>(array: Array<T>, seed: number): Array<T> {
  // Test mode
  if (seed === -1) {
    return array;
  }

  let currentIndex = array.length;
  let temporaryValue: T;
  let randomIndex: number;

  let currentSeed = seed;
  const random = function() {
    const x = Math.sin(currentSeed++) * 10000;
    return x - Math.floor(x);
  };

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
    // Pick a remaining element...
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}
