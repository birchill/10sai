export function navigate(urlOrPath, replace = false) {
  const result = typeof urlOrPath === 'object'
                 ? { type: 'NAVIGATE',
                     ...urlOrPath }
                 : { type: 'NAVIGATE',
                     url: urlOrPath };
  if (replace) {
    result.replace = true;
  }
  return result;
}

export function navigateFromHistory(index, path) {
  return {
    type: 'NAVIGATE_FROM_HISTORY',
    index,
    ...path,
  };
}

// Similar to NAVIGATE except it doesn't trigger the side effects (e.g. loading
// a card etc.).
export function silentlyUpdateUrl(url) {
  return {
    type: 'SILENTLY_UPDATE_URL',
    url,
  };
}

export function followLink(url, direction) {
  return {
    type: 'FOLLOW_LINK',
    url: url || '/',
    direction,
  };
}
