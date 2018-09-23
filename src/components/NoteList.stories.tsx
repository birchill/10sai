import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { NoteState } from '../notes/reducer';
import { NoteList } from './NoteList';
import { SaveState } from '../notes/reducer';

import { RecentKeywordHandling } from '../suggestions/KeywordSuggester';
import { SuggestionResult } from '../suggestions/SuggestionResult';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';
import { KeywordSuggesterContext } from './KeywordSuggesterContext';

const mockKeywordSuggester = {
  recordRecentKeyword: (keyword: string): void => {},
  getSuggestions: (
    input: string,
    defaultSuggestions: string[],
    recentKeywordHandling: RecentKeywordHandling
  ): SuggestionResult => ({}),
} as KeywordSuggester;

interface Props {
  initialNotes: Array<NoteState>;
  updatedNotes: Array<NoteState>;
}

interface State {
  hasRun: boolean;
}

class NoteListExample extends React.PureComponent<Props, State> {
  state: State = {
    hasRun: false,
  };

  constructor(props: Props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick() {
    this.setState({ hasRun: !this.state.hasRun });
  }

  render() {
    const notes: Array<NoteState> = this.state.hasRun
      ? this.props.updatedNotes
      : this.props.initialNotes;

    return (
      <KeywordSuggesterContext.Provider value={mockKeywordSuggester}>
        <NoteList
          notes={notes}
          keywords={[]}
          priority="writing"
          onAddNote={action('onAddNote')}
          onEditNote={action('onEditNote')}
          onDeleteNote={action('onDeleteNote')}
        />
        <button className="run-button" onClick={this.onClick}>
          {this.state.hasRun ? 'Reset' : 'Run'}
        </button>
      </KeywordSuggesterContext.Provider>
    );
  }
}

const okNote = (index: number): NoteState => ({
  formId: index,
  note: {
    id: 'yer',
    content: `Note ${index}`,
    keywords: [],
  },
  saveState: SaveState.Ok,
  originalKeywords: new Set<string>(),
});

const newNote = (index: number): NoteState => ({
  formId: index,
  note: {
    content: `Note ${index}`,
    keywords: [],
  },
  saveState: SaveState.New,
  originalKeywords: new Set<string>(),
});

storiesOf('Components|NoteList', module).add('delete middle note', () => (
  <NoteListExample
    initialNotes={[okNote(1), okNote(2), okNote(3)]}
    updatedNotes={[okNote(1), okNote(3)]}
  />
));
