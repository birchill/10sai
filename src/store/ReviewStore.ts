import { ReviewCardStatus, ReviewSummary } from '../model';
import { stripFields } from '../utils/type-helpers';

import { ProgressContent } from './CardStore';

export interface ReviewContent {
  maxCards: number;
  maxNewCards: number;
  history: Array<{
    id: string;
    // We use the absence of a status field to represent 'passed' and a '1' to
    // represent 'failed'.
    //
    // We use this in preference to a bool since it allows extending with other
    // codes in future and because it's a little more compact to transfer too.
    //
    // We use this in preference to an enum since the order of enums can be
    // easily changed without realizing that it will affect the serialized
    // output and cause compatibility problems for existing records.
    status?: 1;
    previousProgress?: ProgressContent;
  }>;
  finished: boolean;
  modified: number;
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
): ReviewSummary => {
  const result = {
    ...stripFields(review as ExistingReviewDocWithGetMeta, [
      '_id',
      '_rev',
      '_conflicts',
      '_revs_info',
      '_revisions',
      '_attachments',
      'finished',
      'modified',
    ]),
  };

  const history: ReviewSummary['history'] = result.history.map(item => {
    const parsed: ReviewSummary['history'][0] = {
      id: item.id,
      status: item.status ? ReviewCardStatus.Failed : ReviewCardStatus.Passed,
    };
    if (item.previousProgress) {
      const { due } = item.previousProgress;
      parsed.previousProgress = {
        level: item.previousProgress.level,
        due: due ? new Date(due) : null,
      };
    }
    return parsed;
  });

  return { ...result, history };
};

const toReviewContent = ({
  review,
  finished,
}: {
  review: ReviewSummary;
  finished: boolean;
}): ReviewContent => {
  const history: ReviewContent['history'] = review.history.map(item => {
    const serialized: ReviewContent['history'][0] = { id: item.id };
    if (item.status === ReviewCardStatus.Failed) {
      serialized.status = 1;
    }
    return serialized;
  });

  return {
    ...review,
    history,
    finished,
    modified: Date.now(),
  };
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

  async getReview(): Promise<ReviewSummary | null> {
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

  async putReview(review: ReviewSummary): Promise<void> {
    const reviewToPut: PouchDB.Core.Document<ReviewContent> = {
      ...toReviewContent({ review, finished: false }),
      _id: REVIEW_ID,
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
      return { ...(doc as ReviewDoc), finished: true, modified: Date.now() };
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

    await this.db.resolveConflicts(result, (a, b) => {
      // If either review is finished, use the other.
      // If both are finished it doesn't really matter which we use.
      if (b.finished) {
        return a;
      }

      if (a.finished) {
        return b;
      }

      // If either review has yet to make any progress, use the other.
      if (!b.history.length && !!a.history.length) {
        return a;
      }

      if (!a.history.length && !!b.history.length) {
        return b;
      }

      // Otherwise, just use the most recently touched one.
      return a.modified >= b.modified ? a : b;
    });
  }
}
