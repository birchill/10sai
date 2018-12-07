export type RouteAction =
  | NavigateAction
  | UpdateUrlAction
  | FollowLinkAction
  | BeforeScreenChange;

interface NavigationSource {
  type: 'history';
  index: number;
}

export interface NavigateAction {
  type: 'NAVIGATE';
  url?: string;
  path?: string;
  search?: string;
  fragment?: string;
  source?: NavigationSource;
  replace?: boolean;
}

export interface NavigateByUrlParams {
  url: string;
  replace?: boolean;
}

export interface NavigateByPathParams {
  path: string;
  search?: string;
  fragment?: string;
  source?: NavigationSource;
  replace?: boolean;
}

export function navigate(
  params: NavigateByUrlParams | NavigateByPathParams
): NavigateAction {
  return {
    type: 'NAVIGATE',
    ...params,
  };
}

// Similar to NAVIGATE except it doesn't trigger the side effects (e.g. loading
// a card etc.).
export interface UpdateUrlAction {
  type: 'UPDATE_URL';
  url: string;
}

export function updateUrl(url: string): UpdateUrlAction {
  return {
    type: 'UPDATE_URL',
    url,
  };
}

type Direction = 'forwards' | 'backwards' | 'replace';

export interface FollowLinkAction {
  type: 'FOLLOW_LINK';
  url: string;
  direction: Direction;
  active: boolean;
}

export function followLink(
  url: string,
  direction: Direction = 'forwards',
  active: boolean = false
): FollowLinkAction {
  return {
    type: 'FOLLOW_LINK',
    url: url || '/',
    direction,
    active,
  };
}

export interface BeforeScreenChange {
  type: 'BEFORE_SCREEN_CHANGE';
}

export function beforeScreenChange(): BeforeScreenChange {
  return {
    type: 'BEFORE_SCREEN_CHANGE',
  };
}
