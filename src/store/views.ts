export const cardMapFunction = (
  cardPrefix: string,
  progressPrefix: string
) => `function(doc) {
    if (!doc._id.startsWith('${progressPrefix}')) {
      return;
    }

    emit(doc._id, {
      _id: '${cardPrefix}' + doc._id.substr('${progressPrefix}'.length),
      progress: {
        level: doc.level,
        reviewed: doc.reviewed,
      },
    });
  }`;

export const newCardMapFunction = (
  cardPrefix: string,
  progressPrefix: string
) => `function(doc) {
    if (
      !doc._id.startsWith('${progressPrefix}') ||
      doc.reviewed !== null
    ) {
      return;
    }

    emit(doc._id, {
      _id: '${cardPrefix}' + doc._id.substr('${progressPrefix}'.length),
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

export const getOverduenessFunction = (
  reviewTime: Date,
  cardPrefix: string,
  progressPrefix: string
) =>
  `function(doc) {
    if (
      !doc._id.startsWith('${progressPrefix}') ||
      typeof doc.level !== 'number' ||
      typeof doc.reviewed !== 'number'
    ) {
      return;
    }

    if (doc.level === 0) {
      // Unfortunately 'Infinity' doesn't seem to work here
      emit(Number.MAX_VALUE, {
        _id: '${cardPrefix}' + doc._id.substr('${progressPrefix}'.length),
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
      _id: '${cardPrefix}' + doc._id.substr('${progressPrefix}'.length),
      progress: {
        level: doc.level,
        reviewed: doc.reviewed,
      }
    });
  }`;

// TODO: Make this search notes too once we introduce them
export const keywordMapFunction = cardPrefix => `function(doc) {
    if (!doc._id.startsWith('${cardPrefix}')) {
      return;
    }

    if (!Array.isArray(doc.keywords) || !doc.keywords.length) {
      return;
    }

    for (const keyword of doc.keywords) {
      emit([keyword.toLowerCase(), keyword], 1);
    }
  }`;

export const tagMapFunction = cardPrefix => `function(doc) {
    if (!doc._id.startsWith('${cardPrefix}')) {
      return;
    }

    if (!Array.isArray(doc.tags) || !doc.tags.length) {
      return;
    }

    for (const tag of doc.tags) {
      emit([tag.toLowerCase(), tag], 1);
    }
  }`;
