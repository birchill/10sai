import { DataStore } from './store/DataStore';
import { PROGRESS_PREFIX } from './store/CardStore';
import { stripFields } from './utils/type-helpers';

const dataStore = new DataStore();

async function listOrphans() {
  const orphans = await dataStore.cardStore.getOrphanedCards();

  const container = document.getElementById('orphaned-cards')!;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!orphans.length) {
    container.textContent = 'No orphaned cards found.';
    return;
  }

  for (const card of orphans) {
    if (!card) {
      continue;
    }

    const id = `orphan-${card._id}`;

    const div = document.createElement('div');
    div.classList.add('box-and-label');
    container.appendChild(div);

    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('id', id);
    checkbox.setAttribute('name', 'orphan-card');
    checkbox.setAttribute('value', card._id);
    div.appendChild(checkbox);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(card);
    label.appendChild(pre);
    div.appendChild(label);
  }

  const fixButton = document.createElement('input');
  fixButton.setAttribute('type', 'button');
  fixButton.setAttribute('value', 'Restore');
  container.appendChild(fixButton);

  fixButton.addEventListener(
    'click',
    async () => {
      const checkedCards = document.querySelectorAll(
        'input[type=checkbox][name=orphan-card]:checked'
      ) as NodeListOf<HTMLInputElement>;
      const putResults = [];
      for (const checkbox of checkedCards) {
        putResults.push(
          dataStore.cardStore.addProgressDocumentForCard(checkbox.value)
        );
      }
      try {
        await Promise.all(putResults);
      } catch (e) {
        console.error(e);
      }
      listOrphans();
    },
    { once: true }
  );
}

async function listOrphanedProgress() {
  const orphans = await dataStore.cardStore.getOrphanedProgress();

  const container = document.getElementById('orphaned-progress')!;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!orphans.length) {
    container.textContent = 'No orphaned progress documents found.';
    return;
  }

  for (const progress of orphans) {
    if (!progress) {
      continue;
    }

    const id = `orphan-${progress._id}`;

    const div = document.createElement('div');
    div.classList.add('box-and-label');
    container.appendChild(div);

    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('id', id);
    checkbox.setAttribute('name', 'orphan-progress');
    checkbox.setAttribute('value', progress._id);
    div.appendChild(checkbox);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(progress);
    label.appendChild(pre);
    div.appendChild(label);
  }

  const deleteButton = document.createElement('input');
  deleteButton.setAttribute('type', 'button');
  deleteButton.setAttribute('value', 'Delete');
  container.appendChild(deleteButton);

  deleteButton.addEventListener(
    'click',
    async () => {
      const checkedProgress = document.querySelectorAll(
        'input[type=checkbox][name=orphan-progress]:checked'
      ) as NodeListOf<HTMLInputElement>;
      const deleteResults = [];
      for (const checkbox of checkedProgress) {
        deleteResults.push(
          dataStore.cardStore.deleteProgressDocument(checkbox.value)
        );
      }
      try {
        await Promise.all(deleteResults);
      } catch (e) {
        console.error(e);
      }
      listOrphanedProgress();
    },
    { once: true }
  );
}

async function listUnrecognizedDocs() {
  const unrecognizedDocs = await dataStore.getUnrecognizedDocs();

  const container = document.getElementById('unrecognized-docs')!;
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!unrecognizedDocs.length) {
    container.textContent = 'No unrecognized documents found.';
    return;
  }

  for (const doc of unrecognizedDocs) {
    if (!doc) {
      continue;
    }

    const id = `unrecognized-${doc._id}`;

    const div = document.createElement('div');
    div.classList.add('box-and-label');
    container.appendChild(div);

    const checkbox = document.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.setAttribute('id', id);
    checkbox.setAttribute('name', 'unrecognized-doc');
    checkbox.setAttribute('value', doc._id);
    div.appendChild(checkbox);

    const label = document.createElement('label');
    label.setAttribute('for', id);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(doc);
    label.appendChild(pre);
    div.appendChild(label);
  }

  const deleteButton = document.createElement('input');
  deleteButton.setAttribute('type', 'button');
  deleteButton.setAttribute('value', 'Delete');
  container.appendChild(deleteButton);

  deleteButton.addEventListener(
    'click',
    async () => {
      const checkedUnrecognized = document.querySelectorAll(
        'input[type=checkbox][name=unrecognized-doc]:checked'
      ) as NodeListOf<HTMLInputElement>;
      const ids = Array.from(checkedUnrecognized).map(
        checkbox => checkbox.value
      );
      await dataStore.deleteUnrecognizedDocs(ids);
      listUnrecognizedDocs();
    },
    { once: true }
  );
}

function watchForMigrate() {
  document.getElementById('migrate-db')!.addEventListener('click', () => {
    migrate();
  });
}

interface OldProgressContent {
  level: number;
  reviewed: number | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

async function migrate() {
  const progressDocs = await dataStore.db!.allDocs<OldProgressContent>({
    include_docs: true,
    startkey: PROGRESS_PREFIX,
    endkey: PROGRESS_PREFIX + '\ufff0',
  });

  const migration = [];

  for (const progress of progressDocs.rows) {
    if (progress.doc && typeof progress.doc.reviewed !== 'undefined') {
      migration.push({
        ...stripFields(progress.doc, ['reviewed']),
        due: progress.doc.reviewed
          ? progress.doc.reviewed + progress.doc.level * MS_PER_DAY
          : 0,
      });
    }
  }

  try {
    await dataStore.db!.bulkDocs(migration);
    console.info('Migration completed successfully.');
  } catch (e) {
    console.error(e);
  }
}

function watchForDelete() {
  document.getElementById('delete-db')!.addEventListener('click', () => {
    dataStore.destroy();
  });
}

listOrphans();
listOrphanedProgress();
listUnrecognizedDocs();
watchForMigrate();
watchForDelete();
