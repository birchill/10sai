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

// Similar to navigate except it doesn't trigger the side effects and only
// updates the current URL if it matches |prevUrl|.
export function silentlyUpdateUrl(index, newUrl) {
  return {
    type: 'SILENTLY_UPDATE_URL',
    index,
    url: newUrl,
  };
}

export function followLink(url, direction) {
  return {
    type: 'FOLLOW_LINK',
    url: url || '/',
    direction,
  };
}
