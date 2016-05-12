/* global define, it, describe */

import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import SyncStatus from '../../src/sync-status';
import SyncSettingsPanel from '../../src/components/SyncSettingsPanel';

sinon.assert.expose(assert, { prefix: '' });

describe('<SyncSettingsPanel />', () => {
  const stub = sinon.stub();

  it('has a summary label', () => {
    const subject =
      shallow(
        <SyncSettingsPanel syncState={SyncStatus.NOT_CONFIGURED}
          server="" onSubmit={stub} />
      );

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });
});
