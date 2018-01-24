/* global describe, expect, it */
/* eslint arrow-body-style: [ "off" ] */

import {
  routeFromURL,
  routeFromPath,
  URLFromRoute,
  routesEqual,
} from './router';

describe('router:routeFromPath', () => {
  it('converts empty path to route', () => {
    expect(routeFromPath()).toEqual({ screen: '' });
  });

  it('converts root path to route', () => {
    expect(routeFromPath('/')).toEqual({ screen: '' });
  });

  it('converts popup path to route', () => {
    expect(routeFromPath('/settings')).toEqual({
      screen: '',
      popup: 'settings',
    });
  });

  it('converts new card path to route', () => {
    expect(routeFromPath('/cards/new')).toEqual({ screen: 'edit-card' });
  });

  it('converts edit card path to route', () => {
    expect(routeFromPath('/cards/abc')).toEqual({
      screen: 'edit-card',
      card: 'abc',
    });
  });

  it('converts review path to route', () => {
    expect(routeFromPath('/review')).toEqual({ screen: 'review' });
  });

  it('converts blank lookup path to route', () => {
    expect(routeFromPath('/lookup')).toEqual({ screen: 'lookup' });
  });

  it('converts lookup with keyword path to route', () => {
    expect(routeFromPath('/lookup', 'q=テスト')).toEqual({
      screen: 'lookup',
      search: { q: 'テスト' },
    });
  });

  it('parses query string', () => {
    expect(routeFromPath('/', 'abc=123')).toEqual({
      screen: '',
      search: { abc: '123' },
    });
  });

  it('parses query string with leading ?', () => {
    expect(routeFromPath('/', '?abc=123')).toEqual({
      screen: '',
      search: { abc: '123' },
    });
  });

  it('parses query string with empty value', () => {
    expect(routeFromPath('/', 'abc')).toEqual({
      screen: '',
      search: { abc: null },
    });
  });

  it('decodes % encoded query string parameters', () => {
    expect(routeFromPath('/', 'abc=foo%20hoge')).toEqual({
      screen: '',
      search: { abc: 'foo hoge' },
    });
  });

  it('decodes % encoded query string parameters in keys and values', () => {
    expect(routeFromPath('/', '%E5%87%BA%E8%BA%AB=%E4%BB%99%E5%8F%B0')).toEqual(
      { screen: '', search: { 出身: '仙台' } }
    );
  });

  it('decodes % encoded emoji', () => {
    expect(routeFromPath('/', 'feeling=%F0%9F%98%8A')).toEqual({
      screen: '',
      search: { feeling: '😊' },
    });
  });

  it('decodes + encoded query string parameters', () => {
    expect(routeFromPath('/', 'abc=foo+hoge')).toEqual({
      screen: '',
      search: { abc: 'foo hoge' },
    });
  });

  it('parses multiple query string parameters', () => {
    expect(routeFromPath('/', 'abc=123&def=456')).toEqual({
      screen: '',
      search: { abc: '123', def: '456' },
    });
  });

  it('parses repeated query string parameters', () => {
    expect(routeFromPath('/', 'abc=123&abc=456')).toEqual({
      screen: '',
      search: { abc: ['123', '456'] },
    });
  });

  it('parses fragments', () => {
    expect(routeFromPath('/', null, 'abc')).toEqual({
      screen: '',
      fragment: 'abc',
    });
  });

  it('parses fragments with leading #', () => {
    expect(routeFromPath('/', null, '#abc')).toEqual({
      screen: '',
      fragment: 'abc',
    });
  });

  it('decodes % encoded fragments', () => {
    expect(routeFromPath('/', null, '#one%20two')).toEqual({
      screen: '',
      fragment: 'one two',
    });
  });
});

describe('router:routeFromURL', () => {
  it('converts empty url to route', () => {
    expect(routeFromURL('')).toEqual({ screen: '' });
  });

  it('converts root url to route', () => {
    expect(routeFromURL('/')).toEqual({ screen: '' });
  });

  it('converts popup url to route', () => {
    expect(routeFromURL('/settings')).toEqual({
      screen: '',
      popup: 'settings',
    });
  });

  it('converts new card path to route', () => {
    expect(routeFromURL('/cards/new')).toEqual({ screen: 'edit-card' });
  });

  it('converts edit card path to route', () => {
    expect(routeFromURL('/cards/abc')).toEqual({
      screen: 'edit-card',
      card: 'abc',
    });
  });

  it('converts review path to route', () => {
    expect(routeFromURL('/review')).toEqual({ screen: 'review' });
  });

  it('converts blank lookup path to route', () => {
    expect(routeFromURL('/lookup')).toEqual({ screen: 'lookup' });
  });

  it('converts lookup with keyword path to route', () => {
    expect(routeFromURL('/lookup?q=テスト')).toEqual({
      screen: 'lookup',
      search: { q: 'テスト' },
    });
  });

  it('parses popup url with fragment', () => {
    expect(routeFromURL('/settings#sync')).toEqual({
      screen: '',
      popup: 'settings',
      fragment: 'sync',
    });
  });

  it('parses url with fragment and query string', () => {
    expect(routeFromURL('/settings?abc=def#sync')).toEqual({
      screen: '',
      popup: 'settings',
      search: { abc: 'def' },
      fragment: 'sync',
    });
  });
});

describe('router:URLFromRoute', () => {
  it('serializes empty route to root url', () => {
    expect(URLFromRoute()).toEqual('/');
  });

  it('serializes root route to root url', () => {
    expect(URLFromRoute({ screen: '' })).toEqual('/');
  });

  it('serializes popup route to url', () => {
    expect(URLFromRoute({ screen: '', popup: 'settings' })).toEqual(
      '/settings'
    );
  });

  it('serializes new card route to path', () => {
    expect(URLFromRoute({ screen: 'edit-card' })).toEqual('/cards/new');
  });

  it('serializes edit card route to path', () => {
    expect(URLFromRoute({ screen: 'edit-card', card: 'abc' })).toEqual(
      '/cards/abc'
    );
  });

  it('serializes review route to path', () => {
    expect(URLFromRoute({ screen: 'review' })).toEqual('/review');
  });

  it('serializes blank lookup route to path', () => {
    expect(URLFromRoute({ screen: 'lookup' })).toEqual('/lookup');
  });

  it('serializes lookup route with keyword to path', () => {
    expect(URLFromRoute({ screen: 'lookup', search: { q: 'テスト' } })).toEqual(
      '/lookup?q=%E3%83%86%E3%82%B9%E3%83%88'
    );
  });

  it('serializes query string', () => {
    expect(URLFromRoute({ screen: '', search: { abc: '123' } })).toEqual(
      '/?abc=123'
    );
  });

  it('serializes query string with empty value', () => {
    expect(URLFromRoute({ screen: '', search: { abc: null } })).toEqual(
      '/?abc'
    );
  });

  it('serializes multiple query string parameters', () => {
    expect(
      URLFromRoute({ screen: '', search: { abc: '123', def: '456' } })
    ).toEqual('/?abc=123&def=456');
  });

  it('serializes repeated query string parameters', () => {
    expect(
      URLFromRoute({ screen: '', search: { abc: ['123', '456'] } })
    ).toEqual('/?abc=123&abc=456');
  });

  it('serializes % encoded query string parameters in keys and values', () => {
    expect(URLFromRoute({ screen: '', search: { 出身: '仙台' } })).toEqual(
      '/?%E5%87%BA%E8%BA%AB=%E4%BB%99%E5%8F%B0'
    );
  });

  it('serializes % encoded emoji', () => {
    expect(URLFromRoute({ screen: '', search: { feeling: '😊' } })).toEqual(
      '/?feeling=%F0%9F%98%8A'
    );
  });
  it('serializes + encoded query string parameters', () => {
    expect(URLFromRoute({ screen: '', search: { abc: 'foo hoge' } })).toEqual(
      '/?abc=foo+hoge'
    );
  });
  it('serializes fragments', () => {
    expect(URLFromRoute({ screen: '', fragment: 'abc' })).toEqual('/#abc');
  });
  it('serializes % encoded fragments', () => {
    expect(URLFromRoute({ screen: '', fragment: 'one two' })).toEqual(
      '/#one%20two'
    );
  });
  it('serializes popups, fragments, query strings in the right order', () => {
    expect(
      URLFromRoute({
        screen: '',
        popup: 'settings',
        search: { abc: '123', def: '456' },
        fragment: 'hash',
      })
    ).toEqual('/settings?abc=123&def=456#hash');
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
      expect(routesEqual(routeFromURL(route), routeFromURL(route))).toBe(true);
    }
    for (let i = 0; i < testRoutes.length; i++) {
      const routeA = testRoutes[i];
      const routeB = testRoutes[i < testRoutes.length - 1 ? i + 1 : 0];
      expect(routesEqual(routeFromURL(routeA), routeFromURL(routeB))).toBe(
        false
      );
    }
  });
});
