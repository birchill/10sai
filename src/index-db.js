import CardStore from './CardStore';

const cardStore = new CardStore();

async function listOrphans() {
  const orphans = await cardStore.getOrphanedCards();

  // Empty container
  const container = document.getElementById('orphaned-cards');
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  if (!orphans.length) {
    container.textContent = 'No orphaned cards found.';
    return;
  }

  for (const card of orphans) {
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

  fixButton.addEventListener('click', async () => {
    const checkedCards = document.querySelectorAll(
      'input[type=checkbox][name=orphan-card]:checked'
    );
    const putResults = [];
    for (const checkbox of checkedCards) {
      putResults.push(cardStore.addProgressRecordForCard(checkbox.value));
    }
    try {
      await Promise.all(putResults);
    } catch (e) {
      console.error(e);
    }
    listOrphans();
  }, { once: true });
}

listOrphans();
