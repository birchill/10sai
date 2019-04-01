import queryString from 'query-string';
import deepEqual from 'deep-equal';

// Rough sketch of URL structure
//
// /                     - Main screen (card summary)
// /?q=search&max-due=40 - Summary screen with some searching / filtering going
//                         on
// /settings             - Settings popup (over whatever screen is showing)
// /cards/asdfasdf       - View card with id 'adsfasdf'
// /cards/new            - Add card screen
// /review               - Review cards, default settings
// /review?limit=50&q=search&max-due=40 - Review cards but with query params
// /lookup               - Lookup screen
// /lookup?q=abc         - Lookup screen with search time 'abc'
//
// When we go to add subjects all of this will be prefixed with a subject and
// the default root URL will just redirect(?) to the last-opened deck
//
// We don't anticipate sharing cards between subjects. But what about reviewing
// across subjects?

export interface SearchParams {
  // The OutputParams in @types/query-string seems to ignore the null case.
  [key: string]: string | string[] | undefined | null;
}

interface RouteBase {
  popup?: 'settings';
  search?: SearchParams;
  fragment?: string;
}

interface GenericRoute extends RouteBase {
  screen: '' | 'lookup' | 'review';
}

interface EditCardRoute extends RouteBase {
  screen: 'edit-card';
  card?: string;
}

export type Route = GenericRoute | EditCardRoute;

export function routeFromURL(url: string): Route {
  let path = url;

  // Helper function to split string |str| into two parts at the first
  // occurrence of |delim|.
  const splitAtFirst = (str: string, delim: string) => {
    let splitStart = str.indexOf(delim);
    if (splitStart === -1) {
      splitStart = str.length;
    }
    return [str.substring(0, splitStart), str.substring(splitStart + 1)];
  };

  // Strip fragment
  let fragment: string;
  [path, fragment] = splitAtFirst(path, '#');

  // Strip and parse query string
  let search: string;
  [path, search] = splitAtFirst(path, '?');

  return routeFromPath(path, search, fragment);
}

export function routeFromPath(
  path?: string,
  search?: string | null,
  fragment?: string | null
): Route {
  let route: Route = { screen: '' };

  // Trim leading /
  if (path && path[0] === '/') {
    path = path.substr(1);
  }

  if (path === 'settings') {
    route.popup = 'settings';
  } else if (path === 'lookup') {
    route.screen = 'lookup';
  } else if (path === 'cards/new') {
    route = { screen: 'edit-card' };
  } else if (path && path.startsWith('cards/')) {
    route = {
      screen: 'edit-card',
      card: path.substr('cards/'.length),
    };
  } else if (path === 'review') {
    route.screen = 'review';
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

export function URLFromRoute(route: Route = { screen: '' }): string {
  let url = '/';

  // Map route to URL
  // (Eventually we should probably do some high-level matching to see which
  // regexp to use and then call pathToRegexp.compile here).
  if (route.popup === 'settings') {
    url += 'settings';
  } else if (route.screen === 'lookup') {
    url += 'lookup';
  } else if (route.screen === 'edit-card') {
    url += 'cards/' + ((route as EditCardRoute).card || 'new');
  } else if (route.screen === 'review') {
    url += 'review';
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

export function routesEqual(a: Route, b: Route): boolean {
  return deepEqual(a, b);
}
