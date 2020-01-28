import { Review } from '../model';
import { stripFields } from '../utils/type-helpers';

export interface ReviewContent {
  maxCards: number;
  maxNewCards: number;
  completed: number;
  newCardsCompleted: number;
  history: string[];
  failed: string[];
  finished: boolean;
}

type ReviewDoc = PouchDB.Core.Document<ReviewContent>;
type ExistingReviewDoc = PouchDB.Core.ExistingDocument<ReviewContent>;
type ExistingReviewDocWithChanges = PouchDB.Core.ExistingDocument<
  ReviewContent & PouchDB.Core.ChangesMeta
>;
type ExistingReviewDocWithGetMeta = PouchDB.Core.ExistingDocument<
  ReviewContent & PouchDB.Core.GetMeta
>;

export const REVIEW_ID = 'review-default';

const parseReview = (
  review: ExistingReviewDoc | ExistingReviewDocWithGetMeta | ReviewDoc
): Review => {
  const result = {
    ...stripFields(review as ExistingReviewDocWithGetMeta, [
      '_id',
      '_rev',
      '_conflicts',
      '_revs_info',
      '_revisions',
      '_attachments',
      'finished',
    ]),
  };

  return result;
};

const isReviewChangeDoc = (
  changeDoc:
    | PouchDB.Core.ExistingDocument<any & PouchDB.Core.ChangesMeta>
    | undefined
): changeDoc is ExistingReviewDocWithChanges => {
  return changeDoc && changeDoc._id === REVIEW_ID;
};

type EmitFunction = (type: string, ...args: any[]) => void;

export class ReviewStore {
  db: PouchDB.Database;

  constructor(db: PouchDB.Database) {
    this.db = db;
  }

  async getReview(): Promise<Review | null> {
    const review = await this.getReviewDoc();
    return review && !review.finished ? parseReview(review) : null;
  }

  private async getReviewDoc(): Promise<ExistingReviewDocWithGetMeta | null> {
    try {
      return await this.db.get<ReviewContent>(REVIEW_ID);
    } catch (_) {
      return null;
    }
  }

  async putReview(review: Review): Promise<void> {
    const reviewToPut: PouchDB.Core.Document<ReviewContent> = {
      ...review,
      _id: REVIEW_ID,
      finished: false,
    };

    await this.db.upsert<ReviewContent>(REVIEW_ID, () => reviewToPut);
  }

  async finishReview(): Promise<void> {
    await this.db.upsert<ReviewContent>(REVIEW_ID, doc => {
      if (!doc.hasOwnProperty('finished') || doc.finished) {
        return false;
      }

      // This cast is needed because the typings for pouchdb-upsert deliberately
      // chose to represent `{} | Core.Document<Content>` as
      // `Partial<Core.Document<Content>>`. We have already dealt with the empty
      // object case above so this is safe.
      return { ...(doc as ReviewDoc), finished: true };
    });
  }

  async onChange(
    change: PouchDB.Core.ChangesResponseChange<{}>,
    emit: EmitFunction
  ) {
    if (!isReviewChangeDoc(change.doc)) {
      return;
    }

    if (change.doc._deleted || change.doc.finished) {
      emit('review', null);
    } else {
      emit('review', parseReview(change.doc));
    }
  }

  async onSyncChange(
    doc: PouchDB.Core.ExistingDocument<{} & PouchDB.Core.ChangesMeta>
  ) {
    if (!isReviewChangeDoc(doc)) {
      return;
    }

    if (doc._deleted) {
      return;
    }

    // Check for conflicts to resolve.
    const result = await this.db.get<ReviewContent>(doc._id, {
      conflicts: true,
    });
    if (!result._conflicts) {
      return;
    }

    const completeness = (review: ReviewContent) => {
      return review.completed - review.failed.length;
    };

    await this.db.resolveConflicts(result, (a, b) => {
      return completeness(a) >= completeness(b) ? a : b;
    });
  }
}
