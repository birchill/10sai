import queryString from 'query-string';
import deepEqual from 'deep-equal';

// Rough sketch of URL structure
//
// /                     - Main screen (card summary)
// /?q=search&max-due=40 - Summary screen with some searching / filtering going
//                         on
// /settings             - Settings popup (over whatever screen is showing)
// /cards/asdfasdf       - View card with id 'adsfasdf'
// /cards/add            - Add card screen
// /notes/asdfasdf       - Likewise, but for notes
// /notes/add            - Needed?
// /review               - Review cards, default settings
// /review?limit=50&q=search&max-due=40 - Review cards but with query params
//
// When we go to add subjects all of this will be prefixed with a subject and
// the default root URL will just redirect(?) to the last-opened deck
//
// We don't anticipate sharing cards between subjects. But what about reviewing
// across subjects?

export function routeFromURL(url) {
  let path = url;

  // Helper function to split string |str| into two parts at the first
  // occurrence of |delim|.
  const splitAtFirst = (str, delim) => {
    let splitStart = str.indexOf(delim);
    if (splitStart === -1) {
      splitStart = str.length;
    }
    return [ str.substring(0, splitStart), str.substring(splitStart + 1) ];
  };

  // Strip fragment
  let fragment;
  // eslint-disable-next-line prefer-const
  [ path, fragment ] = splitAtFirst(path, '#');

  // Strip and parse query string
  let search;
  // eslint-disable-next-line prefer-const
  [ path, search ] = splitAtFirst(path, '?');

  return routeFromPath(path, search, fragment);
}

export function routeFromPath(path, search, fragment) {
  const route = {};

  // Trim leading /
  if (path && path[0] === '/') {
    path = path.substr(1);
  }

  route.screen = '';

  if (path === 'settings') {
    route.popup = 'settings';
  } else if (path === 'cards/new') {
    route.screen = 'edit-card';
  } else if (path && path.startsWith('cards/')) {
    route.screen = 'edit-card';
    route.card = path.substr('cards/'.length);
  }

  // Parse query string
  if (search) {
    if (search[0] === '?') {
      search = search.substr(1);
    }
    route.search = queryString.parse(search);
  }

  // Parse fragment
  if (fragment) {
    if (fragment[0] === '#') {
      fragment = fragment.substr(1);
    }
    try {
      fragment = decodeURIComponent(fragment);
      route.fragment = fragment;
    } catch (e) {
      console.error(`Failed to parse fragment: ${fragment}`);
    }
  }

  return route;
}

export function URLFromRoute(route = {}) {
  let url = '/';

  // Map route to URL
  // (Eventually we should probably do some high-level matching to see which
  // regexp to use and then call pathToRegexp.compile here).
  if (route.popup === 'settings') {
    url += 'settings';
  } else if (route.screen === 'edit-card') {
    url += 'cards/' + (route.card || 'new');
  }

  // Append query string
  if (route.search) {
    url += '?' + queryString.stringify(route.search).replace(/%20/g, '+');
  }

  // Append hash
  if (route.fragment) {
    url += '#' + encodeURIComponent(route.fragment);
  }

  return url;
}

export function routesEqual(a, b) {
  return deepEqual(a, b);
}
