export const ReviewState = {
  IDLE: Symbol('IDLE'), // No review in progress
  LOADING: Symbol('LOADING'), // Currently loading cards for review or
                              // performing initial load
  QUESTION: Symbol('QUESTION'), // Showing the question part of a card
  ANSWER: Symbol('ANSWER'), // Showing the answer part of a card
  COMPLETE: Symbol('COMPLETE'), // Review is finished
};

export default ReviewState;
