import { CARD_PREFIX, PROGRESS_PREFIX } from './records';

export const cardMapFunction = `function(doc) {
    if (!doc._id.startsWith('${PROGRESS_PREFIX}')) {
      return;
    }

    emit(doc._id, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      progress: {
        level: doc.level,
        reviewed: doc.reviewed,
      },
    });
  }`;

export const newCardMapFunction = `function(doc) {
    if (
      !doc._id.startsWith('${PROGRESS_PREFIX}') ||
      doc.reviewed !== null
    ) {
      return;
    }

    emit(doc._id, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      progress: {
        level: doc.level,
        reviewed: doc.reviewed,
      },
    });
  }`;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// We add a small exponential factor when calculating the overdue score of
// cards. This is to prevent high-level but very overdue cards from being
// starved by low-level overdue cards.
//
// The value below is chosen so that a card of level 365 that is half a year
// overdue will have a very slightly higher overdueness than a level 1 card that
// is one day overdue.
const EXP_FACTOR = 0.00225;

export const getOverduenessFunction = (reviewTime: Date) =>
  `function(doc) {
    if (
      !doc._id.startsWith('${PROGRESS_PREFIX}') ||
      typeof doc.level !== 'number' ||
      typeof doc.reviewed !== 'number'
    ) {
      return;
    }

    if (doc.level === 0) {
      // Unfortunately 'Infinity' doesn't seem to work here
      emit(Number.MAX_VALUE, {
        _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
        progress: {
          level: 0,
          reviewed: doc.reviewed,
        },
      });
      return;
    }

    const daysDiff = (${reviewTime.getTime()} - doc.reviewed) / ${MS_PER_DAY};
    const daysOverdue = daysDiff - doc.level;
    const linearComponent = daysOverdue / doc.level;
    const expComponent = Math.exp(${EXP_FACTOR} * daysOverdue) - 1;
    const overdueValue = linearComponent + expComponent;
    emit(overdueValue, {
      _id: '${CARD_PREFIX}' + doc._id.substr('${PROGRESS_PREFIX}'.length),
      progress: {
        level: doc.level,
        reviewed: doc.reviewed,
      }
    });
  }`;
