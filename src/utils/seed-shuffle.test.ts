import { shuffleWithSeed } from './seed-shuffle';

describe('shuffleWithSeed', () => {
  // We use this to keep out unit tests from being dependent on the particulars
  // of the shuffle algorithm
  it('should leave the array untouched for a seed of -1', () => {
    expect(shuffleWithSeed([1, 2, 3, 4, 5], -1)).toEqual([1, 2, 3, 4, 5]);
  });

  it('should produce the same result each time for the same seed', () => {
    expect(shuffleWithSeed([1, 2, 3, 4, 5], 0.43)).toEqual([5, 3, 2, 1, 4]);
  });

  it('should shuffle the array in-place', () => {
    const a = [1, 2, 3, 4, 5];
    shuffleWithSeed(a, 0.43);
    expect(a).toEqual([5, 3, 2, 1, 4]);
  });
});
