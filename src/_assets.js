import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import KeywordSuggesterContext from './components/KeywordSuggesterContext.ts';
import NoteList from './components/NoteList.tsx';
import SaveStatus from './components/SaveStatus.tsx';

const saveStatuses = document.getElementById('save-statuses-container');

(function renderSaveStatus(oldStatus = '') {
  let status;
  do {
    status = ['ok', 'in-progress', 'error', 'new'][
      Math.floor(Math.random() * 4)
    ];
  } while (status === oldStatus);

  ReactDOM.render(
    <>
      <SaveStatus saveState={status} errorMessage={'Error message'} />
      <button
        onClick={() => {
          renderSaveStatus(status);
        }}
      >
        Update
      </button>
      <span className="currentstatus">{`Current: ${status}`}</span>
    </>,
    saveStatuses
  );
})();

const okNote = index => ({
  formId: index,
  note: {
    id: 'yer',
    content: `Note ${index}`,
    keywords: [],
  },
  saveState: 'ok',
});

const newNote = index => ({
  formId: index,
  note: {
    content: `Note ${index}`,
    keywords: [],
  },
  saveState: 'new',
});

const noteListTestCases = [
  {
    title: 'Delete middle one',
    initialNotes: [okNote(1), okNote(2), okNote(3)],
    updatedNotes: [okNote(1), okNote(3)],
  },
  {
    title: 'Delete outer ones',
    initialNotes: [okNote(1), okNote(2), okNote(3)],
    updatedNotes: [okNote(2)],
  },
  {
    title: 'Add existing',
    initialNotes: [okNote(1), okNote(2)],
    updatedNotes: [okNote(1), okNote(2), okNote(3)],
  },
  {
    title: 'Add new',
    initialNotes: [okNote(1), okNote(2)],
    updatedNotes: [okNote(1), okNote(2), newNote(3)],
  },
  {
    title: 'Everything at once',
    initialNotes: [okNote(1), okNote(2), okNote(3)],
    updatedNotes: [okNote(3), okNote(1), okNote(4)],
  },
];

const noteListContainer = document.getElementById('note-list-container');
const noOp = () => {};
const mockKeywordSuggester = {
  recordRecentKeyword: keyword => {},
  getSuggestions: (input, defaultSuggestions, recentKeywordHandling) => ({}),
};

for (const test of noteListTestCases) {
  const container = document.createElement('div');
  container.classList.add('notelist-test');
  noteListContainer.appendChild(container);

  const render = hasRun => {
    const notes = hasRun ? test.updatedNotes : test.initialNotes;
    ReactDOM.render(
      <KeywordSuggesterContext.Provider value={mockKeywordSuggester}>
        <h4>{test.title}</h4>
        <NoteList
          notes={notes}
          keywords={[]}
          onAddNote={noOp}
          onEditNote={noOp}
          onDeleteNote={noOp}
        />
        <button
          className="run-button"
          onClick={() => {
            render(!hasRun);
          }}
        >
          {hasRun ? 'Reset' : 'Run'}
        </button>
      </KeywordSuggesterContext.Provider>,
      container
    );
  };
  render(false);
}
