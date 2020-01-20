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
        due: doc.due,
      },
    });
  }`;

export const keywordMapFunction = (
  cardPrefix: string,
  notePrefix: string
) => `function(doc) {
    const isNote = doc._id.startsWith('${notePrefix}');

    if (!doc._id.startsWith('${cardPrefix}') && !isNote) {
      return;
    }

    if (!Array.isArray(doc.keywords) || !doc.keywords.length) {
      return;
    }

    for (const keyword of doc.keywords) {
      emit([keyword.toLowerCase().normalize(), keyword], isNote ? 1000 : 1);
    }
  }`;

export const tagMapFunction = (cardPrefix: string) => `function(doc) {
    if (!doc._id.startsWith('${cardPrefix}')) {
      return;
    }

    if (!Array.isArray(doc.tags) || !doc.tags.length) {
      return;
    }

    for (const tag of doc.tags) {
      emit([tag.toLowerCase().normalize(), tag], 1);
    }
  }`;
