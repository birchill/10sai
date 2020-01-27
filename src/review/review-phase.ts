export const enum ReviewPhase {
  Idle = 'idle', // No review in progress
  Loading = 'loading', // Currently loading cards for review or
  // performing initial load
  Front = 'front', // Showing the front of a card
  Back = 'back', // Showing the back of a card
  Complete = 'complete', // Review is finished
}
