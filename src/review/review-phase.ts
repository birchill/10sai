export const enum ReviewPhase {
  Idle = 'idle', // No review in progress
  Loading = 'loading', // Currently loading cards for review or
  // performing initial load
  Reviewing = 'reviewing', // Showing the front of a card
  Complete = 'complete', // Review is finished
}
