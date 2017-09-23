// @format
/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';
import subject from '../../src/reducers/review';
import ReviewState from '../../src/review-states';
import * as actions from '../../src/actions/review';

describe('reducer:review', () => {
  it('should go to the loading state on NEW_REVIEW', () => {
    const updatedState = subject(undefined, actions.newReview(2, 10));
    assert(updatedState.reviewState === ReviewState.LOADING);
    assert(updatedState.maxCards === 10);
    assert(updatedState.maxNewCards === 2);
  });
});
