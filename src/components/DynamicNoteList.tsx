import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

import DataStoreContext from './DataStoreContext';
// This is really weird, but if we write the following as:
//
//   import NoteList from './NoteList';
//
// then _in_production_builds_only_ React will end up destroying and
// re-constructing the NoteList component every time it re-renders.
import { NoteList } from './NoteList';
import { NoteListContext } from '../notes/actions';
import { NoteListWatcher } from '../notes/NoteListWatcher';
import * as noteActions from '../notes/actions';
import { NoteState } from '../notes/reducer';
import { Note } from '../model';
import DataStore from '../store/DataStore';

interface WatcherProps {
  dataStore: DataStore;
  onUpdate: (notes: Array<Note>, deletedIds: Array<string>) => void;
  keywords: Array<string>;
}

export class NoteListWatcherWrapper extends React.PureComponent<WatcherProps> {
  watcher: NoteListWatcher;

  constructor(props: WatcherProps) {
    super(props);
    this.watcher = new NoteListWatcher(
      props.dataStore,
      props.onUpdate,
      props.keywords
    );
  }

  componentDidUpdate(previousProps: WatcherProps) {
    if (!shallowEqual(previousProps.keywords, this.props.keywords)) {
      this.watcher.setKeywords(this.props.keywords);
    }
    if (previousProps.onUpdate !== this.props.onUpdate) {
      this.watcher.listener = this.props.onUpdate;
    }
  }

  componentWillUnmount() {
    this.watcher.disconnect();
  }

  // XXX This probably suggests this component should be a wrapper??
  render() {
    return null;
  }
}

interface InnerProps {
  notes: Array<NoteState>;
  keywords: Array<string>;
  priority: 'reading' | 'writing';
  onAddNote: (initialKeywords: Array<string>) => void;
  onEditNote: (noteFormId: number, change: Partial<Note>) => void;
  onDeleteNote: (noteFormId: number, noteId?: string) => void;
  onUpdateNoteList: (notes: Array<Note>, deletedIds: Array<string>) => void;
}

const DynamicNoteListInner = (props: InnerProps) => (
  <>
    <DataStoreContext.Consumer>
      {(dataStore?: DataStore) => (
        <NoteListWatcherWrapper
          keywords={props.keywords}
          dataStore={dataStore!}
          onUpdate={props.onUpdateNoteList}
        />
      )}
    </DataStoreContext.Consumer>
    <NoteList
      notes={props.notes}
      keywords={props.keywords}
      priority={props.priority}
      onAddNote={props.onAddNote}
      onEditNote={props.onEditNote}
      onDeleteNote={props.onDeleteNote}
    />
  </>
);

interface Props {
  context: NoteListContext;
  notes: Array<NoteState>;
  keywords: Array<string>;
  priority: 'reading' | 'writing';
}

// XXX Use the actual state once we have it
type State = any;

const mapDispatchToProps = (dispatch: Dispatch<State>, ownProps: Props) => ({
  onAddNote: (initialKeywords: string[]) => {
    dispatch(noteActions.addNote(ownProps.context, initialKeywords));
  },
  onEditNote: (noteFormId: number, change: Partial<Note>) => {
    dispatch(noteActions.editNote({ ...ownProps.context, noteFormId }, change));
  },
  onDeleteNote: (noteFormId: number, noteId?: string) => {
    dispatch(
      noteActions.deleteNote({ ...ownProps.context, noteFormId }, noteId)
    );
  },
  onUpdateNoteList: (notes: Array<Note>, deletedIds: Array<string>) => {
    dispatch(noteActions.updateNoteList(ownProps.context, notes, deletedIds));
  },
});

export default connect(
  undefined,
  mapDispatchToProps
)(DynamicNoteListInner);
