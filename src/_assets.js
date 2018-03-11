import ReactDOM from 'react-dom';
import React from 'react';

import 'main.scss'; // eslint-disable-line

import CardPreview from './components/CardPreview.jsx';
import CancelableTextbox from './components/CancelableTextbox.jsx';
import LoadingIndicator from './components/LoadingIndicator.jsx';
import SyncSettingsPanel from './components/SyncSettingsPanel.jsx';
import TabBlock from './components/TabBlock.jsx';
import TextRegion from './components/TextRegion.jsx';
import TricolorProgress from './components/TricolorProgress.jsx';
import TokenList from './components/TokenList.tsx';

import SyncState from './sync/states';

ReactDOM.render(
  <CancelableTextbox
    value="CancelableTextbox"
    onChange={() => {
      console.log('CancelableTextbox: onChange');
    }}
    onFocus={() => {
      console.log('CancelableTextbox: onFocus');
    }}
  />,
  document.getElementById('cancelable-textbox-container')
);

(function renderTokenList(tokens) {
  const onChange = tokens => {
    renderTokenList(tokens);
  };

  ReactDOM.render(
    <TokenList
      tokens={tokens}
      placeholder="Tags (live example)"
      onChange={onChange}
    />,
    document.getElementById('token-list-container')
  );
})([]);

ReactDOM.render(
  <LoadingIndicator />,
  document.getElementById('loading-indicator-container')
);

(function renderTabs(selectedTab) {
  ReactDOM.render(
    <TabBlock className="extra-class" active={selectedTab}>
      <a
        id="lookup-tab"
        href="/lookup"
        aria-controls="lookup-page"
        className="-icon -lookup"
        onClick={evt => {
          renderTabs(selectedTab === 0 ? undefined : 0);
          evt.preventDefault();
        }}
      >
        Lookup
      </a>
      <a
        id="add-tab"
        href="/add"
        aria-controls="add-page"
        className="-icon -plus"
        onClick={evt => {
          renderTabs(selectedTab === 1 ? undefined : 1);
          evt.preventDefault();
        }}
      >
        Add card
      </a>
      <a
        id="review-tab"
        href="/review"
        aria-controls="review-page"
        className="-icon -review -badge"
        data-badge="10%"
        onClick={evt => {
          renderTabs(selectedTab === 2 ? undefined : 2);
          evt.preventDefault();
        }}
      >
        Review
      </a>
    </TabBlock>,
    document.getElementById('tab-block-container')
  );
})();

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
