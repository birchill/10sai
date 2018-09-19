import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import KeywordSuggesterContext from './components/KeywordSuggesterContext.ts';
import CardFormatToolbar from './components/CardFormatToolbar';
import CardPreview from './components/CardPreview.tsx';
import NoteList from './components/NoteList.tsx';
import SaveStatus from './components/SaveStatus.tsx';
import SyncSettingsPanel from './components/SyncSettingsPanel.tsx';
import TextRegion from './components/TextRegion.jsx';
import TricolorProgress from './components/TricolorProgress.jsx';

import SyncState from './sync/states';

const stub = () => {};

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.NOT_CONFIGURED}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-notconfigured-container')
);

const server = {
  name: 'http://server.server.server/path',
  username: 'Username',
  password: 'Password',
};

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.OK}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-uptodate-container')
);

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.IN_PROGRESS}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-inprogress-container')
);

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.PAUSED}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-paused-container')
);

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.OFFLINE}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-offline-container')
);

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.ERROR}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    errorDetail={{ status: 0 }}
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-error-container')
);

ReactDOM.render(
  <SyncSettingsPanel
    syncState={SyncState.OK}
    server={server}
    lastSyncTime={new Date(Date.now() - 1 * 1000 * 60 * 60 * 24)}
    editingServer
    onSubmit={stub}
    onRetry={stub}
    onEdit={stub}
    onCancel={stub}
    onPause={stub}
    onResume={stub}
  />,
  document.getElementById('sync-configure-container')
);

(function renderSummaryPageTabs(selectedTab) {
  const panels = [
    { key: 'notconfigured', label: 'Not configured' },
    { key: 'uptodate', label: 'Up-to-date' },
    { key: 'inprogress', label: 'In progress' },
    { key: 'paused', label: 'Paused' },
    { key: 'offline', label: 'Offline' },
    { key: 'error', label: 'Error' },
    { key: 'configure', label: 'Configure' },
  ];

  const active = panels.findIndex(({ key }) => key === selectedTab.key);

  for (const { key } of panels) {
    const panel = document.getElementById(`sync-${key}-container`);
    if (key === selectedTab.key) {
      panel.hidden = false;
    } else {
      panel.hidden = true;
    }
  }

  ReactDOM.render(
    <TabBlock active={active}>
      {panels.map(({ key, label }) => (
        <a
          key={key}
          id={`${key}-tab`}
          href="yer"
          aria-controls={`sync-${key}-container`}
          onClick={evt => {
            renderSummaryPageTabs({ key });
            evt.preventDefault();
          }}
        >
          {label}
        </a>
      ))}
    </TabBlock>,
    document.getElementById('sync-tab-block-container')
  );
})({ key: 'notconfigured' });

ReactDOM.render(
  <CardPreview question="かんせい" />,
  document.getElementById('card-preview-container')
);

const cardFronts = document.querySelectorAll('.card-front-container');
for (const container of cardFronts) {
  ReactDOM.render(
    <div className="review-card current">
      <div className="front">
        <TextRegion className="question" text={container.dataset.question} />
      </div>
    </div>,
    container
  );
}

const cardBacks = document.querySelectorAll('.card-back-container');
for (const container of cardBacks) {
  ReactDOM.render(
    <div className="review-card current -showanswer">
      <div className="back">
        <TextRegion className="question" text={container.dataset.question} />
        <hr className="card-divider divider" />
        <TextRegion className="answer" text={container.dataset.answer} />
      </div>
    </div>,
    container
  );
}

const cardToolbars = document.querySelectorAll('.card-toolbar-container');
for (const container of cardToolbars) {
  ReactDOM.render(
    <CardFormatToolbar className="toolbar" onClick={() => {}} />,
    container
  );
}

const progressBars = document.querySelectorAll('.tricolor-progress-container');
for (const container of progressBars) {
  ReactDOM.render(
    <TricolorProgress
      aItems={parseFloat(container.dataset.a)}
      bItems={parseFloat(container.dataset.b)}
      cItems={parseFloat(container.dataset.c)}
      title={container.dataset.title}
    />,
    container
  );
}

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
