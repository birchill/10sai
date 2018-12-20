export const enum ReviewPhase {
  Idle = 'idle', // No review in progress
  Loading = 'loading', // Currently loading cards for review or
  // performing initial load
  Question = 'question', // Showing the question part of a card
  Answer = 'answer', // Showing the answer part of a card
  Complete = 'complete', // Review is finished
}
