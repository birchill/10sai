import React from 'react';
import { shallow } from 'enzyme';
import { assert } from 'chai';
import sinon from 'sinon';
import SyncServerForm from '../../src/components/SyncServerForm';

sinon.assert.expose(assert, { prefix: "" });

describe('<SyncServerForm />', () => {
  const stub = sinon.stub();

  it('uses the supplied server name', () => {
    const subject =
      shallow(<SyncServerForm server='abc' onChange={stub} onCancel={stub}/>);

    assert.strictEqual(subject.find('input[name="server"]').prop('value'),
                       'abc');
  });
});
