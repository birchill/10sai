// @format

const DEFAULT_MAX_CARDS = 50;
const DEFAULT_MAX_NEW_CARDS = 10;

class ReviewMaster {
  constructor(cardStore) {
    this._cardStore = cardStore;

    // Cards we have queued based on their 'overdueness' score.
    this._overdueCards = [];
    // Cards that have never been reviewed before including in this review.
    this._newCards = [];
    // Cards which we have failed and have since yet to answer correctly.
    this._failedCardsLevel2 = [];
    // Cards which we once failed but have since answered correctly once.
    this._failedCardsLevel1 = [];
    // Cards we have answered correctly.
    this._completeCards = [];

    this.maxCardsLimit = DEFAULT_MAX_CARDS;
    this.maxNewCardsLimit = DEFAULT_MAX_NEW_CARDS;
    this.newCardsInPlay = 0;

    this._updateQueues();
  }

  // The number of times we anticipate prompting the user assuming they get
  // everything right.
  get questionsRemaining() {
    return (
      this._overdueCards.length +
      this._newCards.length +
      this.repeatQuestionsRemaining
    );
  }

  // The number of questions we have queued based on answering previous
  // questions incorrectly.
  get repeatQuestionsRemaining() {
    return this._failedCardsLevel2.length * 2 + this._failedCardsLevel1.length;
  }

  // The number of cards that have been successfully answered, including cards
  // that we failed but then successfully answered twice in a row.
  get completeCount() {
    // TODO: Should this reflect the number of times we reviewed a card before
    // getting it right so that the progress keeps moving to the right?
    return this._completeCards.length;
  }

  // The number of unseen new cards.
  get newCount() {
    return this._newCards.length;
  }

  async setReviewLimits(limits) {
    if (limits && limits.total) {
      this.maxCardsLimit = limits.total;
    }
    if (limits && limits.unreviewed) {
      this.maxNewCardsLimit = limits.unreviewed;
    }

    await this._updateQueues();
  }

  async _updateQueues() {
    // First fill up with the maximum number of new cards
    const newCardSlots = Math.max(
      this.maxNewCardsLimit - this.newCardsInPlay,
      0
    );
    if (newCardSlots) {
      this._newCards = await this._cardStore.getNewCards({
        limit: newCardSlots,
      });
    }

    // Now fill up the overdue slots
    const overdueCardSlots = Math.max(
      0,
      this.maxCardsLimit -
        this._newCards.length -
        this._completeCards.length -
        this._failedCardsLevel1.length -
        this._failedCardsLevel2.length
    );
    if (overdueCardSlots) {
      this._overdueCards = await this._cardStore.getOverdueCards({
        limit: overdueCardSlots,
      });
    }

    // TODO: Make sure we preserve the current card in the above
    // TODO: Update the next card if it is no longer is in any of the lists
  }

  /*
   * TODO: Some sort promise to indicate the queues have been populated
   * (rather than making all the getters above async?)
  get ready() {
  }
  */
}

export default ReviewMaster;
