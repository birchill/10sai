import React from 'react';
import PropTypes from 'prop-types';
import { Note } from '../model';
import { NoteState } from '../notes/reducer';
import AddNoteButton from './AddNoteButton';
import EditNoteForm from './EditNoteForm';

interface Props {
  notes: Array<NoteState>;
  keywords: Array<string>;
  onAddNote: (initialKeywords: Array<string>) => void;
  onEditNote: (noteFormId: number, change: Partial<Note>) => void;
  onDeleteNote: (noteFormId: number, noteId?: string) => void;
}

export class NoteList extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      notes: PropTypes.arrayOf(
        PropTypes.shape({
          formId: PropTypes.number,
          note: PropTypes.object.isRequired,
          dirtyFields: PropTypes.instanceOf(Set),
          saveState: PropTypes.string.isRequired,
          saveError: PropTypes.object,
        })
      ),
      keywords: PropTypes.arrayOf(PropTypes.string),
      onAddNote: PropTypes.func.isRequired,
      onEditNote: PropTypes.func.isRequired,
      onDeleteNote: PropTypes.func.isRequired,
    };
  }

  addNoteButtonRef: React.RefObject<AddNoteButton>;
  addNoteButtonBbox?: ClientRect;
  lastNoteRef: React.RefObject<EditNoteForm>;

  constructor(props: Props) {
    super(props);

    this.addNoteButtonRef = React.createRef<AddNoteButton>();
    this.lastNoteRef = React.createRef<EditNoteForm>();

    this.handleAddNote = this.handleAddNote.bind(this);
    this.handleNoteChange = this.handleNoteChange.bind(this);
  }

  componentDidUpdate(previousProps: Props) {
    // If we just added a new note, animate it in.
    const hasNewNote = (
      prevNotesList: Array<NoteState>,
      newNotesList: Array<NoteState>
    ) =>
      prevNotesList.length + 1 === newNotesList.length &&
      prevNotesList.every((note, i) => note.note === newNotesList[i].note) &&
      typeof newNotesList[newNotesList.length - 1].note.id === 'undefined';
    if (hasNewNote(previousProps.notes, this.props.notes)) {
      this.animateNewNote();

      // Focus the note
      if (this.lastNoteRef.current) {
        this.lastNoteRef.current.focus();
      }
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
    if (!this.lastNoteRef.current) {
      return;
    }
    const newNote = this.lastNoteRef.current.form;
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
  }

  handleAddNote() {
    const initialKeywords = [];
    // Make the first keyword in the list the initial keyword.
    if (this.props.keywords.length) {
      initialKeywords.push(this.props.keywords[0]);
    }

    // Record the position of the Add Note button so we can animate it later.
    if (this.addNoteButtonRef.current && this.addNoteButtonRef.current.elem) {
      this.addNoteButtonBbox = this.addNoteButtonRef.current.elem.getBoundingClientRect();
    }

    this.props.onAddNote(initialKeywords);
  }

  handleNoteChange<K extends keyof Note>(
    noteFormId: number,
    field: K,
    value: Note[K] | Array<Note[K]>
  ) {
    this.props.onEditNote(noteFormId, { [field]: value });
  }

  render() {
    return (
      <>
        <div className="notes">
          {this.props.notes.map((note, i) => {
            const ref =
              i === this.props.notes.length - 1 ? this.lastNoteRef : undefined;
            return (
              <EditNoteForm
                key={note.formId}
                className="noteform"
                formId={note.formId}
                note={note.note}
                relatedKeywords={this.props.keywords}
                ref={ref}
                onChange={this.handleNoteChange}
                onDelete={this.props.onDeleteNote}
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
    );
  }
}

export default NoteList;
