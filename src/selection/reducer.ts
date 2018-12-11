import { AppState } from '../reducer';
import { Action } from '../actions';

// This is a special reducer that takes the whole updated state object as its
// input.
//
// I'd love to remove this functionality and just make the active card
// a function of the state, but I think the way users expect it to behave is
// stative. For example, if you are looking at the "Lookup" tab and the card
// being reviewed differs from the card being edited, which one is active
// probably should depend on how you got there -- were you just reviewing or
// just editing?
//
// (That said, I suspect eventually I'll discover that this UX of having the
// active card being tied to reviewing is confusing and I'll overhaul the whole
// thing somehow.)

export interface SelectionState {
  activeCardId: string | undefined;
}

export function selection(state: AppState, action: Action): AppState {
  const reviewCardId = state.review.currentCard
    ? state.review.currentCard._id
    : undefined;
  const editCardId = state.edit.forms.active.card._id;
  const currentScreen =
    state.route && state.route.history && state.route.history.length
      ? state.route.history[state.route.index].screen
      : undefined;

  switch (action.type) {
    // --- Edit related changes ---

    // If we just finished loading a card and it is still the card being edited,
    // make it the active card.
    case 'FINISH_LOAD_CARD':
      if (editCardId && action.formId === state.edit.forms.active.formId) {
        return {
          ...state,
          selection: { activeCardId: editCardId },
        };
      }
      return state;

    // If we saved a new card, make it the active card.
    case 'FINISH_SAVE_CARD':
      if (!state.selection.activeCardId && editCardId) {
        return {
          ...state,
          selection: { activeCardId: editCardId },
        };
      }
      return state;

    // If we just started a new card, clear the active card
    case 'NEW_CARD':
      if (state.selection.activeCardId && !editCardId) {
        return {
          ...state,
          selection: { activeCardId: undefined },
        };
      }
      return state;

    // If we deleted the active card, clear it
    case 'DELETE_CARD':
      if (
        typeof action.cardId === 'string' &&
        action.cardId === state.selection.activeCardId
      ) {
        return {
          ...state,
          selection: { activeCardId: undefined },
        };
      }
      return state;

    // --- Sync related changes ---

    // If the active card was deleted remotely, clear it
    case 'SYNC_EDIT_CARD':
      if (
        action.change.card._id === state.selection.activeCardId &&
        action.change.deleted
      ) {
        return {
          ...state,
          selection: { activeCardId: undefined },
        };
      }
      return state;

    // --- Navigation related changes ---

    case 'NAVIGATE': {
      // If we navigated to the review screen, and there is a current card, use
      // it.
      if (currentScreen === 'review' && reviewCardId) {
        return {
          ...state,
          selection: { activeCardId: reviewCardId },
        };
      }

      // If we returned to the home screen, clear the current card.
      // (I'm not totally sure this is the desired behavior.)
      if (!currentScreen && state.selection.activeCardId) {
        return {
          ...state,
          selection: { activeCardId: undefined },
        };
      }
      return state;
    }

    // --- Review related changes ---

    // If we started a new review or updated a review, make the current card, if
    // any, the active card.
    //
    // We only do this if we are on the review screen however since we could
    // trigger a review load in the background. In that case we'll update the
    // active card when we navigate to the review screen.
    case 'REVIEW_LOADED':
      if (
        currentScreen === 'review' &&
        state.selection.activeCardId !== reviewCardId
      ) {
        return {
          ...state,
          selection: { activeCardId: reviewCardId },
        };
      }
      return state;

    // If we updated the card during a review, make the current card, if any,
    // the active card.
    case 'PASS_CARD':
    case 'FAIL_CARD':
      if (state.selection.activeCardId !== reviewCardId) {
        return {
          ...state,
          selection: { activeCardId: reviewCardId },
        };
      }
      return state;

    // If we deleted the active card (due to sync), clear it
    case 'DELETE_REVIEW_CARD':
      if (action.id === state.selection.activeCardId) {
        return {
          ...state,
          selection: { activeCardId: undefined },
        };
      }
      return state;

    default:
      return state;
  }
}

export default selection;
