import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch, connect } from 'react-redux';

import { Card, Note } from '../model';
import AddNoteButton from './AddNoteButton';
import EditCardToolbar from './EditCardToolbar';
import EditCardForm from './EditCardForm';
import EditCardNotFound from './EditCardNotFound';
import EditNoteForm from './EditNoteForm';
import EditorState from '../edit/EditorState';
import * as editActions from '../edit/actions';
import { EditFormState, EditNote, EditState, FormId } from '../edit/reducer';
import * as routeActions from '../route/actions';

interface Props {
  forms: {
    active: EditFormState;
  };
  active: boolean;
  onEdit: (id: FormId, change: Partial<Card>) => void;
  onDelete: (id: FormId) => void;
  onAddNote: (id: FormId, initialKeywords: string[]) => void;
}

export class EditCardScreen extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.any,
          editorState: PropTypes.symbol.isRequired,
          card: PropTypes.object.isRequired,
          deleted: PropTypes.bool,
          notes: PropTypes.arrayOf(
            PropTypes.shape({
              note: PropTypes.object.isRequired,
              noteState: PropTypes.string.isRequired,
            })
          ),
        }).isRequired,
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired,
      onAddNote: PropTypes.func.isRequired,
    };
  }

  activeFormRef: React.RefObject<EditCardForm>;
  addNoteButtonRef: React.RefObject<AddNoteButton>;
  addNoteButtonBbox?: ClientRect;
  notesRef: React.RefObject<HTMLDivElement>;
  lastNoteRef: React.RefObject<EditNoteForm>;

  constructor(props: Props) {
    super(props);

    this.activeFormRef = React.createRef<EditCardForm>();
    this.addNoteButtonRef = React.createRef<AddNoteButton>();
    this.notesRef = React.createRef<HTMLDivElement>();
    this.lastNoteRef = React.createRef<EditNoteForm>();

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleAddNote = this.handleAddNote.bind(this);
  }

  componentDidMount() {
    if (this.props.active) {
      this.activate();
    }
  }

  componentDidUpdate(previousProps: Props) {
    if (this.props.active && previousProps.active !== this.props.active) {
      this.activate();
    }

    // If we just added a new note, animate it in.
    const hasNewNote = (
      prevNotesList: Array<EditNote>,
      newNotesList: Array<EditNote>
    ) =>
      prevNotesList.length + 1 === newNotesList.length &&
      prevNotesList.every((note, i) => note.note === newNotesList[i].note) &&
      typeof newNotesList[newNotesList.length - 1].note.id === 'undefined';
    if (
      hasNewNote(
        previousProps.forms.active.notes,
        this.props.forms.active.notes
      )
    ) {
      this.animateNewNote();

      // Focus the note
      if (this.lastNoteRef.current) {
        this.lastNoteRef.current.focus();
      }
    }
  }

  activate() {
    if (
      this.props.forms.active.editorState === EditorState.EMPTY &&
      this.activeFormRef.current &&
      this.activeFormRef.current.questionTextBoxRef.current
    ) {
      this.activeFormRef.current.questionTextBoxRef.current.focus();
    }
  }

  animateNewNote() {
    // First, check we have a button to animate.
    if (!this.addNoteButtonRef.current || !this.addNoteButtonRef.current.elem) {
      return;
    }

    // Next check for animations support.
    if (typeof this.addNoteButtonRef.current.elem.animate !== 'function') {
      return;
    }

    // And check we have the necessary geometry information.
    if (!this.addNoteButtonBbox) {
      return;
    }

    // Finally, check we have a notes form to align with.
    if (!this.notesRef.current) {
      return;
    }
    // Typescript typings put animate on HTMLElement instead of Element... oh
    // well.
    const newNote = this.notesRef.current.querySelector(
      '.noteform:last-of-type'
    ) as HTMLElement | undefined;
    if (!newNote) {
      return;
    }

    // Timing
    const stretchDuration: number = 250;
    const stretchEasing: string = 'cubic-bezier(.43,1.17,.88,1.1)';
    const fadeDuration: number = 150;
    const fadeOffset = stretchDuration / (stretchDuration + fadeDuration);

    // Get the button positions
    const prevButtonPosition: ClientRect = this.addNoteButtonBbox;
    const newButtonPosition: ClientRect = this.addNoteButtonRef.current.elem.getBoundingClientRect();

    // Get the position of the new note.
    const newNotePosition: ClientRect = newNote.getBoundingClientRect();

    // Streth the button to the size of the new note.
    this.addNoteButtonRef.current.stretchTo({
      width: newNotePosition.width,
      height: newNotePosition.height,
      duration: stretchDuration,
      holdDuration: fadeDuration,
      easing: stretchEasing,
    });

    // Shift the button up from its new position so that it lines up with the
    // note.
    const initialYShift = prevButtonPosition.top - newButtonPosition.top;
    const finalYShift =
      initialYShift + (newNotePosition.height - prevButtonPosition.height) / 2;
    this.addNoteButtonRef.current.elem.animate(
      [
        {
          transform: `translateY(${initialYShift}px)`,
          opacity: 1,
          easing: stretchEasing,
        },
        {
          transform: `translateY(${finalYShift}px)`,
          opacity: 1,
          offset: fadeOffset,
        },
        {
          transform: `translateY(${finalYShift}px)`,
          opacity: 0,
        },
      ],
      { duration: stretchDuration + fadeDuration }
    );

    // Fade in the actual note
    newNote.animate(
      { opacity: [0, 1] },
      {
        delay: stretchDuration * 0.6,
        fill: 'backwards',
        duration: fadeDuration,
      }
    );

    // Stretch in add button
    this.addNoteButtonRef.current.elem.animate(
      {
        transform: ['scale(0)', 'scale(0)', 'scale(0.6, 0.5)', 'scale(1)'],
      },
      {
        duration: stretchDuration,
        easing: stretchEasing,
        delay: stretchDuration + fadeDuration,
      }
    );

    // Scroll to the new note
    newNote.scrollIntoView({ behavior: 'smooth' });
  }

  handleFormChange<K extends keyof Card>(field: K, value: Card[K]) {
    this.props.onEdit(this.props.forms.active.formId, { [field]: value });
  }

  handleDelete() {
    this.props.onDelete(this.props.forms.active.formId);
  }

  handleAddNote() {
    const initialKeywords = [];
    // Make the first keyword in the list the initial keyword.
    if (
      this.props.forms.active.card.keywords &&
      this.props.forms.active.card.keywords.length
    ) {
      initialKeywords.push(this.props.forms.active.card.keywords[0]);
    }

    // Record the position of the Add Note button so we can animate it later.
    if (this.addNoteButtonRef.current && this.addNoteButtonRef.current.elem) {
      this.addNoteButtonBbox = this.addNoteButtonRef.current.elem.getBoundingClientRect();
    }

    this.props.onAddNote(this.props.forms.active.formId, initialKeywords);
  }

  render() {
    const relatedKeywords = this.props.forms.active.card.keywords || [];

    return (
      <section className="edit-screen" aria-hidden={!this.props.active}>
        <EditCardToolbar
          editorState={this.props.forms.active.editorState}
          onDelete={this.handleDelete}
        />
        {this.props.forms.active.editorState !== EditorState.NOT_FOUND ? (
          <>
            <EditCardForm
              onChange={this.handleFormChange}
              {...this.props.forms.active}
              ref={this.activeFormRef}
            />
            <hr className="note-divider divider" />
            <div className="notes" ref={this.notesRef}>
              {this.props.forms.active.notes.map((note, i) => {
                const ref =
                  i === this.props.forms.active.notes.length - 1
                    ? this.lastNoteRef
                    : undefined;
                return (
                  <EditNoteForm
                    key={note.note.id || `new-note-${i}`}
                    className="noteform"
                    note={note.note}
                    relatedKeywords={relatedKeywords}
                    ref={ref}
                  />
                );
              })}
            </div>
            <AddNoteButton
              className="addnote"
              ref={this.addNoteButtonRef}
              onClick={this.handleAddNote}
            />
          </>
        ) : (
          <EditCardNotFound deleted={!!this.props.forms.active.deleted} />
        )}
      </section>
    );
  }
}

// XXX Convert to State once we've converted all reducers to TS
const mapStateToProps = (state: any) => ({
  forms: (state.edit as EditState).forms,
});
const mapDispatchToProps = (dispatch: Dispatch) => ({
  onEdit: (formId: FormId, change: Partial<Card>) => {
    dispatch(editActions.editCard(formId, change));
  },
  onDelete: (formId: FormId) => {
    dispatch(editActions.deleteEditCard(formId));
    dispatch(routeActions.followLink('/'));
  },
  onAddNote: (formId: FormId, initialKeywords: string[]) => {
    dispatch(editActions.addEditNote(formId, initialKeywords));
  },
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditCardScreen);
