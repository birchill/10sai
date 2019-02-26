import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { NoteState } from '../notes/reducer';
import { NoteList } from './NoteList';
import { SaveState } from '../edit/reducer';

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

    const buttonStyle = {
      marginLeft: 'auto',
      marginRight: 'auto',
      marginBottom: '1em',
      display: 'block',
    };

    return (
      <KeywordSuggesterContext.Provider value={mockKeywordSuggester}>
        <button className="button" style={buttonStyle} onClick={this.onClick}>
          {this.state.hasRun ? 'Reset' : 'Run'}
        </button>
        <NoteList
          notes={notes}
          keywords={[]}
          priority="writing"
          onAddNote={action('onAddNote')}
          onEditNote={action('onEditNote')}
          onDeleteNote={action('onDeleteNote')}
        />
      </KeywordSuggesterContext.Provider>
    );
  }
}

const okNote = (index: number, keywords: Array<string> = []): NoteState => ({
  formId: index,
  note: {
    id: 'yer',
    content: `Note ${index}`,
    keywords,
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

storiesOf('Components|NoteList', module)
  .add('delete middle note', () => (
    <NoteListExample
      initialNotes={[okNote(1), okNote(2), okNote(3)]}
      updatedNotes={[okNote(1), okNote(3)]}
    />
  ))
  .add('delete outer ones', () => (
    <NoteListExample
      initialNotes={[okNote(1), okNote(2), okNote(3)]}
      updatedNotes={[okNote(2)]}
    />
  ))
  .add('add existing', () => (
    <NoteListExample
      initialNotes={[okNote(1), okNote(2)]}
      updatedNotes={[okNote(1), okNote(2), okNote(3)]}
    />
  ))
  .add('add new', () => (
    <NoteListExample
      initialNotes={[okNote(1), okNote(2)]}
      updatedNotes={[okNote(1), okNote(2), newNote(3)]}
    />
  ))
  .add('everything at once', () => (
    <NoteListExample
      initialNotes={[okNote(1), okNote(2), okNote(3)]}
      updatedNotes={[okNote(3), okNote(1), okNote(4)]}
    />
  ))
  .add('reading priority', () => (
    <KeywordSuggesterContext.Provider value={mockKeywordSuggester}>
      <NoteList
        notes={[
          okNote(1, ['Keyword']),
          okNote(2, ['Keyword 1', 'Keyword 2']),
          okNote(3),
        ]}
        keywords={['Keyword']}
        priority="reading"
        onAddNote={action('onAddNote')}
        onEditNote={action('onEditNote')}
        onDeleteNote={action('onDeleteNote')}
      />
    </KeywordSuggesterContext.Provider>
  ));
