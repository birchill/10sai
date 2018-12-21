import * as React from 'react';
import { configure, shallow } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

import { SyncServerForm } from './SyncServerForm';

configure({ adapter: new Adapter() });

describe('<SyncServerForm />', () => {
  const stub = jest.fn();

  it('uses the supplied server name', () => {
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />
    );

    expect(subject.find('CancelableTextbox[name="server"]').prop('value')).toBe(
      'abc'
    );
  });

  it('allows the server name to be overwritten', () => {
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />
    );

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');

    expect(subject.find('CancelableTextbox[name="server"]').prop('value')).toBe(
      'def'
    );
  });

  it('resets the entered text when the server name is updated', () => {
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />
    );

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.setProps({ server: 'ghi' });

    expect(subject.find('CancelableTextbox[name="server"]').prop('value')).toBe(
      'ghi'
    );
  });

  it('calls the callback when cancelled', () => {
    const onCancel = jest.fn();
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={stub} onCancel={onCancel} />
    );

    subject.find('input[name="cancel"]').simulate('click');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('resets the entered text when cancelled', () => {
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={stub} onCancel={stub} />
    );

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.find('input[name="cancel"]').simulate('click');

    expect(subject.find('CancelableTextbox[name="server"]').prop('value')).toBe(
      'abc'
    );
  });

  it('passes the server to the callback when submitted', () => {
    const onSubmit = jest.fn();
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={onSubmit} onCancel={stub} />
    );

    subject.find('form').simulate('submit', { preventDefault: stub });

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'abc',
      username: '',
      password: '',
    });
  });

  it('passes the updated server to the callback when submitted', () => {
    const onSubmit = jest.fn();
    const subject = shallow(
      <SyncServerForm server="abc" onSubmit={onSubmit} onCancel={stub} />
    );

    subject.find('CancelableTextbox[name="server"]').simulate('change', 'def');
    subject.find('form').simulate('submit', { preventDefault: stub });

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'def',
      username: '',
      password: '',
    });
  });
});
