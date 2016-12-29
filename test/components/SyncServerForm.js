/* global define, it, describe */

import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import SyncServerForm from '../../src/components/SyncServerForm';

sinon.assert.expose(assert, { prefix: '' });

describe('<SyncServerForm />', () => {
  const stub = sinon.stub();

  it('uses the supplied server name', () => {
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />);

    assert.strictEqual(subject.find('CancelableTextbox[name="server"]')
                       .prop('value'), 'abc');
  });

  it('allows the server name to be overwritten', () => {
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />);

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');

    assert.strictEqual(subject.find('CancelableTextbox[name="server"]')
                       .prop('value'), 'def');
  });

  it('resets the entered text when the server name is updated', () => {
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />);

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.setProps({ server: 'ghi' });

    assert.strictEqual(subject.find('CancelableTextbox[name="server"]')
                       .prop('value'), 'ghi');
  });

  it('calls the callback when cancelled', () => {
    const onCancel = sinon.spy();
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={stub}
        onCancel={onCancel} />);

    subject.find('input[name="cancel"]').simulate('click');

    assert.calledOnce(onCancel);
  });

  it('resets the entered text when cancelled', () => {
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />);

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.find('input[name="cancel"]').simulate('click');

    assert.strictEqual(subject.find('CancelableTextbox[name="server"]')
                       .prop('value'), 'abc');
  });

  it('passes the server to the callback when submitted', () => {
    const onSubmit = sinon.spy();
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={onSubmit}
        onCancel={stub} />);

    subject.find('form').simulate('submit', { preventDefault: stub });

    assert.calledWith(onSubmit, { name: 'abc', username: '', password: '' });
  });

  it('passes the updated server to the callback when submitted', () => {
    const onSubmit = sinon.spy();
    const subject =
      shallow(<SyncServerForm server="abc" onSubmit={onSubmit}
        onCancel={stub} />);

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.find('form').simulate('submit', { preventDefault: stub });

    assert.calledWith(onSubmit, { name: 'def', username: '', password: '' });
  });
});
