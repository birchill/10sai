// @format

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

    this.maxCardsLimit = 0;
    this.maxNewCardsLimit = 0;
    this.newCardsInPlay = 0;

    this.queueUpdate = Promise.resolve();
  }

  // The number of cards that have been successfully answered, including cards
  // that we failed but then successfully answered twice in a row.
  get completeCount() {
    // TODO: Should this reflect the number of times we reviewed a card before
    // getting it right so that the progress keeps moving to the right?
    return this._completeCards.length;
  }

  // The number of cards we've failed at least once and have yet to get to get
  // right twice in a row.
  get failCount() {
    return this._failedCardsLevel2.length + this._failedCardsLevel1.length;
  }

  // The number of unseen new cards.
  get newCount() {
    return this._newCards.length;
  }

  // The total number of unseen cards.
  get unseenCount() {
    return this._newCards.length + this._overdueCards.length;
  }

  // The number of times we anticipate prompting the user assuming they get
  // everything right.
  //
  // (Not sure if we actually need this yet but it might come in handy if we
  // later decide to try to estimate how long until the review is complete...)
  get questionsRemaining() {
    return (
      this._overdueCards.length +
      this._newCards.length +
      this._failedCardsLevel2.length * 2 +
      this._failedCardsLevel1.length
    );
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
    // Wait in case another queue update is in progress
    await this.queueUpdate;

    // Create a new promise for others to wait on.
    let updateFinished;
    this.queueUpdate = new Promise(resolve => {
      updateFinished = resolve;
    });

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

    updateFinished();
  }
}

export default ReviewMaster;
