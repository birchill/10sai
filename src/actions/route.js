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
