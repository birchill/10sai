// NAVIGATE parameters:
//
// {
//    url: <string>,
//    path: <string>,
//    search: <string>,
//    fragment: <string>,
//    source: 'history'? = ''
//    replace: <bool> = false
// }
//
// * One of 'url' or 'path' should be set.
// * 'path', 'search', and 'fragment' are ignored if 'url' is set.
// * 'source' and 'replace' are optional
export function navigate(params) {
  return {
    type: 'NAVIGATE',
    ...params,
  };
}

// Similar to NAVIGATE except it doesn't trigger the side effects (e.g. loading
// a card etc.).
export function updateUrl(url) {
  return {
    type: 'UPDATE_URL',
    url,
  };
}

export function followLink(url, direction, active = false) {
  return {
    type: 'FOLLOW_LINK',
    url: url || '/',
    direction,
    active,
  };
}

export function beforeScreenChange() {
  return {
    type: 'BEFORE_SCREEN_CHANGE',
  };
}
