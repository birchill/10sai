/* global beforeEach, describe, it */
/* eslint arrow-body-style: [ 'off' ] */

import { expectSaga } from 'redux-saga-test-plan';
import { assert } from 'chai';

import { followLink as followLinkSaga,
         beforeScreenChange as beforeScreenChangeSaga }
       from '../../src/sagas/route';
import EditState from '../../src/edit-states';
import * as routeActions from '../../src/actions/route';
import * as editActions from '../../src/actions/edit';

const followLink = (direction, url) => ({
  type: 'FOLLOW_LINK',
  direction,
  url: url || '/'
});

describe('sagas:route followLink', () => {
  beforeEach('setup global', () => {
    global.history = {
      pushState: () => {},
      replaceState: () => {},
      back: () => {}
    };
  });

  it('does forwards navigation when direction is forwards', () => {
    return expectSaga(followLinkSaga, followLink('forwards'))
      .call([ history, 'pushState' ], { index: 0 }, '', '/')
      .put(routeActions.navigate({ url: '/' }))
      .run();
  });

  it('does forwards navigation when direction is not specified', () => {
    return expectSaga(followLinkSaga, followLink())
      .call([ history, 'pushState' ], { index: 0 }, '', '/')
      .put(routeActions.navigate({ url: '/' }))
      .run();
  });

  it('does forwards navigation when direction is replace but there is no' +
     ' history',
    () => {
      return expectSaga(followLinkSaga, followLink('replace'))
        .call([ history, 'pushState' ], { index: 0 }, '', '/')
        .put(routeActions.navigate({ url: '/' }))
        .run();
    }
  );

  it('does replace navigation when direction is replace', () => {
    return expectSaga(followLinkSaga, followLink('replace', '/?abc=123'))
      .withState({ route: { index: 0, history: [ { screen: '/' } ] } })
      .call([ history, 'replaceState' ], { index: 0 }, '', '/?abc=123')
      .put(routeActions.navigate({ url: '/?abc=123', replace: true }))
      .run();
  });

  it('calls history.back() when the direction is backwards and history matches',
  () => {
    return expectSaga(followLinkSaga, followLink('backwards', '/#abc'))
      .withState({
        route: {
          index: 1,
          history: [
            { screen: '', fragment: 'abc' },
            { screen: '', fragment: 'def' }
          ]
        }
      })
      .call([ history, 'back' ])
      .run();
  });

  it('puts a navigate action when direction is backwards but history' +
     ' does not match because screen does not match',
    () => {
      return expectSaga(followLinkSaga, followLink('backwards', '/settings'))
        .withState({
          route: {
            index: 1,
            history: [ { screen: '' }, { screen: '' } ]
          }
        })
        .call([ history, 'pushState' ], { index: 2 }, '', '/settings')
        .put(routeActions.navigate({ url: '/settings' }))
        .run();
    }
  );

  it('puts a navigate action when direction is backwards but history' +
     ' does not match because query string does not match',
    () => {
      return expectSaga(followLinkSaga, followLink('backwards', '/?abc=123'))
        .withState({
          route: {
            index: 1,
            history: [
              {
                screen: '',
                search: { a: '123', b: '456' }
              },
              { screen: '' }
            ]
          }
        })
        .call([ history, 'pushState' ], { index: 2 }, '', '/?abc=123')
        .put(routeActions.navigate({ url: '/?abc=123' }))
        .run();
    }
  );

  it('puts a navigate action when direction is backwards but history' +
     ' does not match because fragment does not match',
    () => {
      return expectSaga(followLinkSaga, followLink('backwards', '/#ghi'))
        .withState({
          route: {
            index: 1,
            history: [
              { screen: '', fragment: 'abc' },
              { screen: '', fragment: 'def' }
            ]
          }
        })
        .call([ history, 'pushState' ], { index: 2 }, '', '/#ghi')
        .put(routeActions.navigate({ url: '/#ghi' }))
        .run();
    }
  );

  it('puts a navigate action when direction is backwards but history' +
     ' does not match because it is empty',
    () => {
      return expectSaga(followLinkSaga, followLink('backwards', '/#abc'))
        .call([ history, 'pushState' ], { index: 0 }, '', '/#abc')
        .put(routeActions.navigate({ url: '/#abc' }))
        .run();
    }
  );

  it('does nothing if the URL matches the current route and direction is' +
     ' backwards',
    () => {
      return expectSaga(followLinkSaga, followLink('backwards', '/#def'))
        .withState({
          route: {
            index: 1,
            history: [
              { screen: '', fragment: 'abc' },
              { screen: '', fragment: 'def' }
            ]
          }
        })
        .not.call([ history, 'back' ])
        .not.call([ history, 'pushState' ], { index: 2 }, '', '/#def')
        .not.put(routeActions.navigate({ url: '/#def' }))
        .run();
    }
  );

  it('does nothing if the URL matches the current route and direction is' +
     ' replace',
    () => {
      return expectSaga(followLinkSaga, followLink('replace', '/#abc'))
        .withState({
          route: {
            index: 0,
            history: [ { screen: '', fragment: 'abc' } ]
          }
        })
        .not.call([ history, 'replaceState' ], { index: 0 }, '', '/#abc')
        .not.put(routeActions.navigate({ url: '/#abc' }))
        .run();
    }
  );

  it('does nothing if the URL matches the current route and direction is' +
     ' forwards',
    () => {
      return expectSaga(followLinkSaga, followLink('forwards', '/#abc'))
        .withState({
          route: {
            index: 0,
            history: [ { screen: '', fragment: 'abc' } ]
          }
        })
        .not.call([ history, 'pushState' ], { index: 1 }, '', '/#abc')
        .not.put(routeActions.navigate({ url: '/#abc' }))
        .run();
    }
  );
});

describe('sagas:route beforeScreenChange', () => {
  it('throws if the screen-specific actions throw', () => {
    const formId = 'abc';
    const state = {
      edit: { forms: { active: { formId, editState: EditState.DIRTY } } },
      route: {
        index: 0,
        history: [ { screen: 'edit-card' } ]
      },
    };
    const error = { message: 'too bad' };

    return expectSaga(beforeScreenChangeSaga)
      .withState(state)
      .put(editActions.saveEditCard(formId))
      .dispatch(editActions.failSaveCard(formId, error))
      .run()
      .then(() => {
        assert.fail('Should have failed');
      })
      .catch(e => {
        assert.strictEqual(e, error, 'Throws expected message');
      });
  });

  it('throws if there is a navigation while the actions are happenning', () => {
    const formId = 'abc';
    const state = {
      edit: { forms: { active: { formId, editState: EditState.DIRTY } } },
      route: {
        index: 0,
        history: [ { screen: 'edit-card' } ]
      },
    };

    return expectSaga(beforeScreenChangeSaga)
      .withState(state)
      .put(editActions.saveEditCard(formId))
      .dispatch(routeActions.navigate({ url: '/' }))
      .run()
      .then(() => {
        assert.fail('Should have failed');
      })
      .catch(e => {
        assert.deepEqual(
          e.message,
          'Before screen change handling canceled by subsequent navigation',
          'Throws expected message'
        );
      });
  });
});
