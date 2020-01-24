import { collate } from 'pouchdb-collate';

// Perform a binary search in |array| for |id|.
//
// Returns a pair [found, index]. If |found| is true, |index| is the index of
// matching item in |array|. If |found| is false, |index| is the index to use
// such that array.splice(index, 0, id) would keep |array| sorted.
export function findIdInArray(
  id: string,
  array: Array<string>
): [boolean, number] {
  let min = 0;
  let max = array.length - 1;
  let guess: number;

  while (min <= max) {
    guess = Math.floor((min + max) / 2);

    const result = collate(array[guess], id);

    if (result === 0) {
      return [true, guess];
    }

    if (result < 0) {
      min = guess + 1;
    } else {
      max = guess - 1;
    }
  }

  return [false, Math.max(min, max)];
}

// As with findIdInArray but where the array contains objects with an id
// property.
export function findIdInObjectArray(
  id: string,
  array: Array<{ id: string }>
): [boolean, number] {
  return findIdInArray(
    id,
    array.map(item => item.id)
  );
}
