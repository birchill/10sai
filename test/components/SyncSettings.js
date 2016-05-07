import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import SyncSettings from '../../src/components/SyncSettings';

describe('<SyncSettings />', () => {
  it('has a summary label', () => {
    const subject = shallow(<SyncSettings syncState="SYNC_NOT_CONFIGURED" />);

    assert.isAbove(subject.find('.summary').text().length, 0,
                   'Summary label is filled-in');
  });
});
