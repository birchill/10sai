import * as React from 'react';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

import { DataStoreContext } from './DataStoreContext';
import { NoteList } from './NoteList';
import { NoteListContext } from '../notes/actions';
import { NoteListWatcher } from '../notes/NoteListWatcher';
import * as Actions from '../actions';
import { NoteState } from '../notes/reducer';
import { Note } from '../model';
import { DataStore } from '../store/DataStore';
import { Return } from '../utils/type-helpers';

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

interface PropsInner {
  notes: Array<NoteState>;
  keywords: Array<string>;
  priority: 'reading' | 'writing';
  className?: string;
  onAddNote: (initialKeywords: Array<string>) => void;
  onEditNote: (noteFormId: number, change: Partial<Note>) => void;
  onDeleteNote: (noteFormId: number, noteId?: string) => void;
  onUpdateNoteList: (notes: Array<Note>, deletedIds: Array<string>) => void;
}

const DynamicNoteListInner: React.FC<PropsInner> = (props: PropsInner) => (
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
      className={props.className}
      onAddNote={props.onAddNote}
      onEditNote={props.onEditNote}
      onDeleteNote={props.onDeleteNote}
    />
  </>
);

interface Props {
  noteListContext: NoteListContext;
  notes: Array<NoteState>;
  keywords: Array<string>;
  priority: 'reading' | 'writing';
  className?: string;
}

const mapDispatchToProps = (
  dispatch: Dispatch<Actions.Action>,
  ownProps: Props
) => ({
  onAddNote: (initialKeywords: string[]) => {
    dispatch(Actions.addNote(ownProps.noteListContext, initialKeywords));
  },
  onEditNote: (noteFormId: number, change: Partial<Note>) => {
    dispatch(
      Actions.editNote({ ...ownProps.noteListContext, noteFormId }, change)
    );
  },
  onDeleteNote: (noteFormId: number, noteId?: string) => {
    dispatch(
      Actions.deleteNote({ ...ownProps.noteListContext, noteFormId }, noteId)
    );
  },
  onUpdateNoteList: (notes: Array<Note>, deletedIds: Array<string>) => {
    dispatch(
      Actions.updateNoteList(ownProps.noteListContext, notes, deletedIds)
    );
  },
});

export const DynamicNoteList = connect<
  {},
  Return<typeof mapDispatchToProps>,
  Props
>(
  undefined,
  mapDispatchToProps
)(DynamicNoteListInner);
