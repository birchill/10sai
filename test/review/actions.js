/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import * as actions from '../../src/review/actions';

describe('reducer:action', () => {
  it('should weight the random seed towards zero for FAIL_CARD', () => {
    const runs = 1000;
    let total = 0;
    for (let i = 0; i < runs; i++) {
      total += actions.failCard().nextCardSeed;
    }
    // We check for 0.45 since if we check for 0.5 then 50% of the time it might
    // happen to be just below 0.5 and we expect the weighting to at least give
    // us an average below 0.45.
    assert.isBelow(total / runs, 0.45, 'The average seed is less than 0.45');
  });

  it('should weight the random seed towards zero for PASS_CARD', () => {
    const runs = 1000;
    let total = 0;
    for (let i = 0; i < runs; i++) {
      total += actions.passCard().nextCardSeed;
    }
    assert.isBelow(total / runs, 0.45, 'The average seed is less than 0.45');
  });

  it('should weight the random seeds towards zero for REVIEW_LOADED', () => {
    const runs = 1000;
    let nextTotal = 0;
    let currentTotal = 0;
    for (let i = 0; i < runs; i++) {
      const action = actions.reviewLoaded([]);
      nextTotal += action.nextCardSeed;
      currentTotal += action.currentCardSeed;
    }
    assert.isBelow(nextTotal / runs, 0.45,
                   'The average seed for the next card is less than 0.45');
    assert.isBelow(currentTotal / runs, 0.45,
                   'The average seed for the current card is less than 0.45');
  });
});
