import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';

import DataStoreContext from './DataStoreContext';
import NoteList from './NoteList';
import { NoteListContext } from '../notes/actions';
import { NoteListWatcher } from '../notes/NoteListWatcher';
import * as noteActions from '../notes/actions';
import { NoteState } from '../notes/reducer';
import { Note } from '../model';
import DataStore from '../store/DataStore';

interface WatcherProps {
  dataStore: DataStore;
  onUpdate: (notes: Array<Note>) => void;
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

  // XXX This probably suggests this component should be a wrapper??
  render() {
    return null;
  }
}

interface InnerProps {
  notes: Array<NoteState>;
  keywords: Array<string>;
  onAddNote: (initialKeywords: Array<string>) => void;
  onNoteChange: (noteFormId: number, change: Partial<Note>) => void;
  onUpdateNoteList: (notes: Array<Note>) => void;
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
      onAddNote={props.onAddNote}
      onNoteChange={props.onNoteChange}
    />
  </>
);

interface Props {
  context: NoteListContext;
  notes: Array<NoteState>;
  keywords: Array<string>;
}

// XXX Use the actual state once we have it
type State = any;

const mapDispatchToProps = (dispatch: Dispatch<State>, ownProps: Props) => ({
  onAddNote: (initialKeywords: string[]) => {
    dispatch(noteActions.addNote(ownProps.context, initialKeywords));
  },
  onNoteChange: (noteFormId: number, change: Partial<Note>) => {
    dispatch(noteActions.editNote({ ...ownProps.context, noteFormId }, change));
  },
  onUpdateNoteList: (notes: Array<Note>) => {
    dispatch(noteActions.updateNoteList(ownProps.context, notes));
  },
});

export default connect(
  undefined,
  mapDispatchToProps
)(DynamicNoteListInner);
