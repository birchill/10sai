/* global describe, it */
/* eslint arrow-body-style: [ "off" ] */

import { assert } from 'chai';

import {
  routeFromURL,
  routeFromPath,
  URLFromRoute,
  routesEqual,
} from '../../src/route/router';

describe('router:routeFromPath', () => {
  it('converts empty path to route', () => {
    assert.deepEqual(routeFromPath(), { screen: '' });
  });

  it('converts root path to route', () => {
    assert.deepEqual(routeFromPath('/'), { screen: '' });
  });

  it('converts popup path to route', () => {
    assert.deepEqual(routeFromPath('/settings'), {
      screen: '',
      popup: 'settings',
    });
  });

  it('converts new card path to route', () => {
    assert.deepEqual(routeFromPath('/cards/new'), { screen: 'edit-card' });
  });

  it('converts edit card path to route', () => {
    assert.deepEqual(routeFromPath('/cards/abc'), {
      screen: 'edit-card',
      card: 'abc',
    });
  });

  it('converts review path to route', () => {
    assert.deepEqual(routeFromPath('/review'), { screen: 'review' });
  });

  it('converts blank lookup path to route', () => {
    assert.deepEqual(routeFromPath('/lookup'), { screen: 'lookup' });
  });

  it('converts lookup with keyword path to route', () => {
    assert.deepEqual(routeFromPath('/lookup', 'q=テスト'), {
      screen: 'lookup',
      search: { q: 'テスト' },
    });
  });

  it('parses query string', () => {
    assert.deepEqual(routeFromPath('/', 'abc=123'), {
      screen: '',
      search: { abc: '123' },
    });
  });

  it('parses query string with leading ?', () => {
    assert.deepEqual(routeFromPath('/', '?abc=123'), {
      screen: '',
      search: { abc: '123' },
    });
  });

  it('parses query string with empty value', () => {
    assert.deepEqual(routeFromPath('/', 'abc'), {
      screen: '',
      search: { abc: null },
    });
  });

  it('decodes % encoded query string parameters', () => {
    assert.deepEqual(routeFromPath('/', 'abc=foo%20hoge'), {
      screen: '',
      search: { abc: 'foo hoge' },
    });
  });

  it('decodes % encoded query string parameters in keys and values', () => {
    assert.deepEqual(
      routeFromPath('/', '%E5%87%BA%E8%BA%AB=%E4%BB%99%E5%8F%B0'),
      { screen: '', search: { 出身: '仙台' } }
    );
  });

  it('decodes % encoded emoji', () => {
    assert.deepEqual(routeFromPath('/', 'feeling=%F0%9F%98%8A'), {
      screen: '',
      search: { feeling: '😊' },
    });
  });

  it('decodes + encoded query string parameters', () => {
    assert.deepEqual(routeFromPath('/', 'abc=foo+hoge'), {
      screen: '',
      search: { abc: 'foo hoge' },
    });
  });

  it('parses multiple query string parameters', () => {
    assert.deepEqual(routeFromPath('/', 'abc=123&def=456'), {
      screen: '',
      search: { abc: '123', def: '456' },
    });
  });

  it('parses repeated query string parameters', () => {
    assert.deepEqual(routeFromPath('/', 'abc=123&abc=456'), {
      screen: '',
      search: { abc: ['123', '456'] },
    });
  });

  it('parses fragments', () => {
    assert.deepEqual(routeFromPath('/', null, 'abc'), {
      screen: '',
      fragment: 'abc',
    });
  });

  it('parses fragments with leading #', () => {
    assert.deepEqual(routeFromPath('/', null, '#abc'), {
      screen: '',
      fragment: 'abc',
    });
  });

  it('decodes % encoded fragments', () => {
    assert.deepEqual(routeFromPath('/', null, '#one%20two'), {
      screen: '',
      fragment: 'one two',
    });
  });
});

describe('router:routeFromURL', () => {
  it('converts empty url to route', () => {
    assert.deepEqual(routeFromURL(''), { screen: '' });
  });

  it('converts root url to route', () => {
    assert.deepEqual(routeFromURL('/'), { screen: '' });
  });

  it('converts popup url to route', () => {
    assert.deepEqual(routeFromURL('/settings'), {
      screen: '',
      popup: 'settings',
    });
  });

  it('converts new card path to route', () => {
    assert.deepEqual(routeFromURL('/cards/new'), { screen: 'edit-card' });
  });

  it('converts edit card path to route', () => {
    assert.deepEqual(routeFromURL('/cards/abc'), {
      screen: 'edit-card',
      card: 'abc',
    });
  });

  it('converts review path to route', () => {
    assert.deepEqual(routeFromURL('/review'), { screen: 'review' });
  });

  it('converts blank lookup path to route', () => {
    assert.deepEqual(routeFromURL('/lookup'), { screen: 'lookup' });
  });

  it('converts lookup with keyword path to route', () => {
    assert.deepEqual(routeFromURL('/lookup?q=テスト'), {
      screen: 'lookup',
      search: { q: 'テスト' },
    });
  });

  it('parses popup url with fragment', () => {
    assert.deepEqual(routeFromURL('/settings#sync'), {
      screen: '',
      popup: 'settings',
      fragment: 'sync',
    });
  });

  it('parses url with fragment and query string', () => {
    assert.deepEqual(routeFromURL('/settings?abc=def#sync'), {
      screen: '',
      popup: 'settings',
      search: { abc: 'def' },
      fragment: 'sync',
    });
  });
});

describe('router:URLFromRoute', () => {
  it('serializes empty route to root url', () => {
    assert.equal(URLFromRoute(), '/');
  });

  it('serializes root route to root url', () => {
    assert.equal(URLFromRoute({ screen: '' }), '/');
  });

  it('serializes popup route to url', () => {
    assert.equal(URLFromRoute({ screen: '', popup: 'settings' }), '/settings');
  });

  it('serializes new card route to path', () => {
    assert.equal(URLFromRoute({ screen: 'edit-card' }), '/cards/new');
  });

  it('serializes edit card route to path', () => {
    assert.equal(
      URLFromRoute({ screen: 'edit-card', card: 'abc' }),
      '/cards/abc'
    );
  });

  it('serializes review route to path', () => {
    assert.equal(URLFromRoute({ screen: 'review' }), '/review');
  });

  it('serializes blank lookup route to path', () => {
    assert.equal(URLFromRoute({ screen: 'lookup' }), '/lookup');
  });

  it('serializes lookup route with keyword to path', () => {
    assert.equal(
      URLFromRoute({ screen: 'lookup', search: { q: 'テスト' } }),
      '/lookup?q=%E3%83%86%E3%82%B9%E3%83%88'
    );
  });

  it('serializes query string', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { abc: '123' } }),
      '/?abc=123'
    );
  });

  it('serializes query string with empty value', () => {
    assert.equal(URLFromRoute({ screen: '', search: { abc: null } }), '/?abc');
  });

  it('serializes multiple query string parameters', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { abc: '123', def: '456' } }),
      '/?abc=123&def=456'
    );
  });

  it('serializes repeated query string parameters', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { abc: ['123', '456'] } }),
      '/?abc=123&abc=456'
    );
  });

  it('serializes % encoded query string parameters in keys and values', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { 出身: '仙台' } }),
      '/?%E5%87%BA%E8%BA%AB=%E4%BB%99%E5%8F%B0'
    );
  });

  it('serializes % encoded emoji', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { feeling: '😊' } }),
      '/?feeling=%F0%9F%98%8A'
    );
  });
  it('serializes + encoded query string parameters', () => {
    assert.equal(
      URLFromRoute({ screen: '', search: { abc: 'foo hoge' } }),
      '/?abc=foo+hoge'
    );
  });
  it('serializes fragments', () => {
    assert.equal(URLFromRoute({ screen: '', fragment: 'abc' }), '/#abc');
  });
  it('serializes % encoded fragments', () => {
    assert.equal(
      URLFromRoute({ screen: '', fragment: 'one two' }),
      '/#one%20two'
    );
  });
  it('serializes popups, fragments, query strings in the right order', () => {
    assert.equal(
      URLFromRoute({
        screen: '',
        popup: 'settings',
        search: { abc: '123', def: '456' },
        fragment: 'hash',
      }),
      '/settings?abc=123&def=456#hash'
    );
  });
});
describe('router:routesEqual', () => {
  it('compares equal routes', () => {
    const testRoutes = [
      '/',
      '/settings',
      '/settings?abc=123',
      '/settings?abc=123&def=456',
      '/settings#yer',
      '/settings?abc=123&def=456#yer',
      '/abc=123&def=456#yer',
    ];
    for (const route of testRoutes) {
      assert.isTrue(
        routesEqual(routeFromURL(route), routeFromURL(route)),
        `Routes from URL '${route}' should compare equal`
      );
    }
    for (let i = 0; i < testRoutes.length; i++) {
      const routeA = testRoutes[i];
      const routeB = testRoutes[i < testRoutes.length - 1 ? i + 1 : 0];
      assert.isFalse(
        routesEqual(routeFromURL(routeA), routeFromURL(routeB)),
        `Routes from '${routeA}' and '${routeB}' should NOT compare equal`
      );
    }
  });
});
