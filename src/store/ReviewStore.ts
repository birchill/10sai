import { Review } from '../model';
import { REVIEW_PREFIX, ReviewRecord } from './content';

const parseReview = (review: ReviewRecord): Review => {
  const result = {
    ...review,
    reviewTime: new Date(review.reviewTime),
  };
  delete result._id;
  delete result._rev;

  return result;
};

type EmitFunction = (type: string, ...args: any[]) => void;

class ReviewStore {
  db: PouchDB.Database;

  constructor(db: PouchDB.Database) {
    this.db = db;
  }

  async getReview(): Promise<Review | null> {
    const review = await this._getReview();
    return review ? parseReview(review) : null;
  }

  async _getReview(): Promise<ReviewRecord | null> {
    const reviews = await this.db.allDocs<ReviewRecord>({
      include_docs: true,
      descending: true,
      limit: 1,
      startkey: REVIEW_PREFIX + '\ufff0',
      endkey: REVIEW_PREFIX,
    });

    if (!reviews.rows.length || !reviews.rows[0].doc) {
      return null;
    }

    return reviews.rows[0].doc!;
  }

  async putReview(review: Review): Promise<void> {
    const existingReview = await this._getReview();

    // If we don't have an existing review doc to update generate an ID for the
    // review based on the current time.
    // We don't care do much about collisions here. If we overlap, it's ok to
    // just clobber the existing data.
    let reviewId: string;
    if (!existingReview) {
      const timestamp = Date.now() - Date.UTC(2016, 0, 1);
      reviewId = REVIEW_PREFIX + `0${timestamp.toString(36)}`.slice(-8);
    } else {
      reviewId = existingReview._id;
    }

    const reviewToPut: ReviewRecord = {
      ...review,
      _id: reviewId,
      reviewTime: review.reviewTime.getTime(),
    };

    // Copy passed-in review object so upsert doesn't mutate it
    await this.db.upsert<ReviewRecord>(reviewId, () => reviewToPut);
  }

  async deleteReview(): Promise<void> {
    const deleteReviews = async () => {
      const reviews = await this.db.allDocs({
        startkey: REVIEW_PREFIX,
        endkey: REVIEW_PREFIX + '\ufff0',
      });
      if (!reviews.rows.length) {
        return;
      }
      const results = await this.db.bulkDocs(
        reviews.rows.map(row => ({
          _id: row.id,
          _rev: row.value.rev,
          _deleted: true,
        }))
      );
      // Check for any conflicts
      // (Either my reading of the docs is wrong or the types for bulkDocs is
      // wrong but as far as I can tell bulkDocs returns an array of Response
      // and Error objects)
      // FIXME: Verify the above and submit a PR for the typings if they're
      // wrong
      if (
        results.some(
          result =>
            !!(<PouchDB.Core.Error>result).error &&
            (<PouchDB.Core.Error>result).status === 409
        )
      ) {
        await deleteReviews();
      }
    };
    await deleteReviews();
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!change.doc || !change.doc._id.startsWith(REVIEW_PREFIX)) {
      return;
    }

    const currentReviewDoc = await this._getReview();

    // If a review doc was deleted, report null but only if it was the most
    // recent review doc that was deleted.
    if (change.doc._deleted) {
      if (!currentReviewDoc || currentReviewDoc._id < change.doc._id) {
        emit('review', null);
      }
      // Only report changes if they are to the current review doc
    } else if (currentReviewDoc && change.doc._id === currentReviewDoc._id) {
      emit('review', parseReview(<ReviewRecord>change.doc));
    }
  }

  async onSyncChange(
    doc: PouchDB.Core.ExistingDocument<ReviewRecord & PouchDB.Core.ChangesMeta>
  ) {
    if (doc._deleted) {
      return;
    }

    // We could (and we used to) check for old review docs and delete them but
    // in the interests of keeping things simple we just wait until the next
    // call to deleteReview() to delete them.
    const result = await this.db.get<ReviewRecord>(doc._id, {
      conflicts: true,
    });
    if (!result._conflicts) {
      return;
    }

    const completeness = (review: ReviewRecord) => {
      return (
        review.completed -
        review.failedCardsLevel2.length * 2 -
        review.failedCardsLevel1.length
      );
    };

    await this.db.resolveConflicts(result, (a, b) => {
      return completeness(a) >= completeness(b) ? a : b;
    });
  }
}

export default ReviewStore;
