import * as React from 'react';
import memoize from 'memoize-one';

import { Note } from '../model';
import { getFinishedPromise } from '../utils/animation';
import { NoteState, SaveState } from '../notes/reducer';
import { sortNotesByKeywordMatches } from '../notes/sorting';
import { AddNoteButton } from './AddNoteButton';
import { EditNoteForm } from './EditNoteForm';

interface Props {
  notes: Array<NoteState>;
  keywords: Array<string>;
  priority: 'reading' | 'writing';
  className?: string;
  onAddNote: (initialKeywords: Array<string>) => void;
  onEditNote: (noteFormId: number, change: Partial<Note>) => void;
  onDeleteNote: (noteFormId: number, noteId?: string) => void;
}

interface State {
  previousNotes: Array<NoteState>;
  deletingNotes: Array<NoteState>;
  doAnimation: boolean;
}

interface AnimationSnapshot {
  deletedNotes: Array<{
    formId: number;
    top: number;
  }>;
  movedNotes: Array<{
    formId: number;
    top: number;
  }>;
  addedNotes: Array<number>;
  addNoteButtonBbox?: ClientRect;
}

// Animation parameters

const DELETE_EASING = 'ease-in';
const DELETE_DURATION = 200;

const STRETCH_EASING = 'cubic-bezier(.43,1.17,.88,1.1)';
const STRETCH_DURATION = 250;

// const MOVE_EASING = 'ease';
const MOVE_DURATION = 250;

const FADE_DURATION = 150;

const ANIMATION_STAGGER = 50;

export class NoteList extends React.PureComponent<Props, State> {
  static getDerivedStateFromProps(props: Props, state: State) {
    if (!state.doAnimation) {
      return null;
    }

    if (props.notes === state.previousNotes) {
      return null;
    }

    const nextNotes = new Set<number>(props.notes.map(note => note.formId));
    const deletingNotes = state.deletingNotes.slice();

    for (const note of state.previousNotes) {
      if (!nextNotes.has(note.formId)) {
        deletingNotes.push(note);
      }
    }

    return { deletingNotes, previousNotes: props.notes };
  }

  notesContainerRef: React.RefObject<HTMLDivElement>;
  deletingNotesContainerRef: React.RefObject<HTMLDivElement>;
  lastNoteRef: React.RefObject<EditNoteForm>;
  addNoteButtonRef: React.RefObject<AddNoteButton>;
  sortNotes: (
    notes: Array<NoteState>,
    keywords: Array<string>
  ) => Array<NoteState>;
  state: State;

  constructor(props: Props) {
    super(props);

    // Only do animation if we have Web Animation support AND the user has not
    // disabled animations.
    const doAnimation =
      'animate' in HTMLElement.prototype &&
      !matchMedia('(prefers-reduced-motion)').matches;
    this.state = {
      previousNotes: [],
      deletingNotes: [],
      doAnimation,
    };

    this.notesContainerRef = React.createRef<HTMLDivElement>();
    this.deletingNotesContainerRef = React.createRef<HTMLDivElement>();
    this.lastNoteRef = React.createRef<EditNoteForm>();
    this.addNoteButtonRef = React.createRef<AddNoteButton>();

    this.handleAddNote = this.handleAddNote.bind(this);
    this.handleNoteChange = this.handleNoteChange.bind(this);

    this.sortNotes = memoize(
      (notes: Array<NoteState>, keywords: Array<string>): Array<NoteState> =>
        sortNotesByKeywordMatches(notes, keywords)
    );
  }

  getForm(formId: number): HTMLDivElement | null {
    return this.notesContainerRef.current
      ? this.notesContainerRef.current.querySelector(
          `[data-form-id="${formId}"]`
        )
      : null;
  }

  getDeletingForm(formId: number): HTMLDivElement | null {
    return this.deletingNotesContainerRef.current
      ? this.deletingNotesContainerRef.current.querySelector(
          `[data-form-id="${formId}"]`
        )
      : null;
  }

  getSnapshotBeforeUpdate(previousProps: Props): AnimationSnapshot | null {
    if (!this.state.doAnimation) {
      return null;
    }

    // Common case
    if (previousProps.notes === this.props.notes) {
      return null;
    }

    const getTopOfForm = (formId: number): number | null => {
      const form = this.getForm(formId);
      return form ? form.getBoundingClientRect().top : null;
    };

    const snapshot: AnimationSnapshot = {
      // Note that the deletedNotes here differs from deletingNotes in State.
      // The ones in State represent _all_ the currently deleting notes where as
      // deletedNotes represents only the ones that were deleted as part of this
      // update.
      deletedNotes: [],
      addedNotes: [],
      movedNotes: [],
    };

    const previousNotes = new Map<number, number>(
      previousProps.notes.map((note, i) => [note.formId, i] as [number, number])
    );

    for (let i = 0; i < this.props.notes.length; i++) {
      const note = this.props.notes[i];

      if (!previousNotes.has(note.formId)) {
        snapshot.addedNotes.push(note.formId);
      } else {
        const previousPosition = previousNotes.get(note.formId)!;
        if (previousPosition !== i) {
          const top = getTopOfForm(note.formId);
          // If we can't find the form, don't add it to the forms to animate.
          if (typeof top === 'number') {
            snapshot.movedNotes.push({ formId: note.formId, top });
          }
        }
        previousNotes.delete(note.formId);
      }
    }

    // Any remaining notes must have now been deleted
    for (const formId of previousNotes.keys()) {
      const top = getTopOfForm(formId);
      if (typeof top === 'number') {
        snapshot.deletedNotes.push({ formId, top });
      }
    }

    // Check we got a change
    if (
      !snapshot.addedNotes.length &&
      !snapshot.movedNotes.length &&
      !snapshot.deletedNotes.length
    ) {
      return null;
    }

    // Record the position of the Add Note button so we can animate it later.
    const addNoteButton = this.addNoteButtonRef.current;
    if (addNoteButton && addNoteButton.elem) {
      snapshot.addNoteButtonBbox = addNoteButton.elem.getBoundingClientRect();
    }

    return snapshot;
  }

  componentDidUpdate(
    previousProps: Props,
    previousState: State,
    snapshot: AnimationSnapshot | null
  ) {
    if (!snapshot) {
      return;
    }

    // If we're adding a new note, then we use a different animation where we
    // enlarge the addNote button and fade the button in its place.
    if (
      snapshot.addedNotes.length === 1 &&
      !snapshot.movedNotes.length &&
      !snapshot.deletedNotes.length &&
      this.props.notes[this.props.notes.length - 1].saveState === SaveState.New
    ) {
      this.animateNewNote(snapshot);

      // Focus the new note and scroll it into view.
      if (this.lastNoteRef.current) {
        this.lastNoteRef.current.focus();
        this.lastNoteRef.current.scrollIntoView();
      }
    } else {
      this.animateExistingNotes(snapshot);
    }
  }

  animateNewNote(snapshot: AnimationSnapshot) {
    // First, check we have a button to animate.
    if (!this.addNoteButtonRef.current || !this.addNoteButtonRef.current.elem) {
      return;
    }
    const addNoteButton = this.addNoteButtonRef.current;
    const addNoteButtonElem = this.addNoteButtonRef.current.elem;

    // Next check for animations support.
    if (typeof addNoteButtonElem.animate !== 'function') {
      return;
    }

    // And check we have the necessary geometry information.
    if (!snapshot.addNoteButtonBbox) {
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
    const fadeOffset = STRETCH_DURATION / (STRETCH_DURATION + FADE_DURATION);

    // Get the button positions
    const prevButtonPosition = snapshot.addNoteButtonBbox;
    const newButtonPosition = addNoteButtonElem.getBoundingClientRect();

    // Get the position of the new note.
    const newNotePosition = newNote.getBoundingClientRect();

    // Streth the button to the size of the new note.
    //
    // (Note this currently assumes that both notes and the add note are
    // centered. If that ceases to be the case we'll need to pass the x position
    // too.)
    addNoteButton.stretchTo({
      width: newNotePosition.width,
      height: newNotePosition.height,
      duration: STRETCH_DURATION,
      holdDuration: FADE_DURATION,
      easing: STRETCH_EASING,
    });

    // Shift the button up from its new position so that it lines up with the
    // note.
    const initialYShift = prevButtonPosition.top - newButtonPosition.top;
    const finalYShift =
      initialYShift + (newNotePosition.height - prevButtonPosition.height) / 2;
    addNoteButtonElem.animate(
      [
        {
          transform: `translateY(${initialYShift}px)`,
          opacity: 1,
          easing: STRETCH_EASING,
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
      { duration: STRETCH_DURATION + FADE_DURATION }
    );

    // Fade in the actual note
    newNote.animate(
      { opacity: [0, 1] },
      {
        delay: STRETCH_DURATION * 0.6,
        fill: 'backwards',
        duration: FADE_DURATION,
      }
    );

    // Stretch in add button
    addNoteButtonElem.animate(
      {
        transform: ['scale(0)', 'scale(0)', 'scale(0.6, 0.5)', 'scale(1)'],
      },
      {
        duration: STRETCH_DURATION,
        easing: STRETCH_EASING,
        delay: STRETCH_DURATION + FADE_DURATION,
      }
    );
  }

  animateExistingNotes(snapshot: AnimationSnapshot) {
    if (
      !this.notesContainerRef.current ||
      !this.deletingNotesContainerRef.current
    ) {
      return;
    }

    let lastAnimation: Animation | undefined;

    // First animate-out any deleting notes
    let delay = 0;
    const deletePromises: Array<Promise<Animation>> = [];
    for (const noteRef of snapshot.deletedNotes) {
      const form = this.getDeletingForm(noteRef.formId);
      if (form) {
        const yOffset = form.getBoundingClientRect().top - noteRef.top;
        lastAnimation = form.animate(
          {
            transform: [
              `translateY(${-yOffset}px) scale(1)`,
              `translateY(${-yOffset}px) scale(0)`,
            ],
          },
          {
            duration: DELETE_DURATION,
            easing: DELETE_EASING,
            delay,
            fill: 'both',
          }
        );
        deletePromises.push(getFinishedPromise(lastAnimation));
        delay += ANIMATION_STAGGER;
      }
    }

    if (snapshot.deletedNotes.length) {
      // Allow a bit of overlap between stages
      delay += DELETE_DURATION - ANIMATION_STAGGER * 2;
    }

    // Then shuffle any notes that need shuffling
    for (const noteRef of snapshot.movedNotes) {
      const form = this.getForm(noteRef.formId);
      if (form) {
        const yOffset = form.getBoundingClientRect().top - noteRef.top;
        lastAnimation = form.animate(
          { transform: [`translateY(${-yOffset}px)`, 'translateY(0px)'] },
          { duration: MOVE_DURATION, easing: 'ease', delay, fill: 'backwards' }
        );
        delay += ANIMATION_STAGGER;
      }
    }

    // Move add button too
    let movedAddButton = false;
    if (snapshot.addedNotes.length - snapshot.deletedNotes.length !== 0) {
      const addNoteButton = this.addNoteButtonRef.current;
      if (addNoteButton && addNoteButton.elem && snapshot.addNoteButtonBbox) {
        const yOffset =
          addNoteButton.elem.getBoundingClientRect().top -
          snapshot.addNoteButtonBbox.top;
        lastAnimation = addNoteButton.elem.animate(
          { transform: [`translateY(${-yOffset}px)`, 'translateY(0px)'] },
          { duration: MOVE_DURATION, easing: 'ease', delay, fill: 'backwards' }
        );
        movedAddButton = true;
        delay += ANIMATION_STAGGER;
      }
    }

    if (snapshot.movedNotes.length || movedAddButton) {
      // Allow a bit of overlap between stages
      delay += MOVE_DURATION - ANIMATION_STAGGER * 2;
    }

    // Add new notes
    for (const formId of snapshot.addedNotes) {
      const form = this.getForm(formId);
      if (form) {
        lastAnimation = form.animate(
          { transform: ['scale(0)', 'scale(1)'] },
          {
            duration: STRETCH_DURATION,
            easing: STRETCH_EASING,
            delay,
            fill: 'backwards',
          }
        );
        delay += ANIMATION_STAGGER;
      }
    }

    // Make sure to properly remove any deleting notes from state once the
    // delete animations have finished.
    if (lastAnimation && snapshot.deletedNotes.length) {
      getFinishedPromise(lastAnimation).then(() => {
        const deletingNotes = this.state.deletingNotes.slice();
        const toDelete = new Set<number>(
          snapshot.deletedNotes.map(ref => ref.formId)
        );
        for (let i = deletingNotes.length - 1; i >= 0; i--) {
          if (toDelete.has(deletingNotes[i].formId)) {
            deletingNotes.splice(i, 1);
          }
        }

        this.setState({ deletingNotes });
      });
    }
  }

  handleAddNote() {
    const initialKeywords = [];
    // Make the first keyword in the list the initial keyword.
    if (this.props.keywords.length) {
      initialKeywords.push(this.props.keywords[0]);
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
    // Returns a copy of the array (i.e. props are not mutated).
    //
    // It's also really important note to mutate sortedNotes itself since
    // this.sortNotes is memo-ized and will return the same object, namely
    // |sortedNotes|, next time for the same input.
    const sortedNotes = this.sortNotes(this.props.notes, this.props.keywords);
    const lastRealNoteIndex = this.props.notes.length - 1;

    let className = 'note-list';
    if (this.props.className) {
      className += ' ' + this.props.className;
    }

    let noteFormClassName = 'noteform';
    if (this.props.priority === 'reading') {
      noteFormClassName += ' -hideeditcontrols';
    }

    return (
      <div className={className}>
        <div className="notecontainer" ref={this.notesContainerRef}>
          {sortedNotes.map((note, i) => {
            const ref = i === lastRealNoteIndex ? this.lastNoteRef : undefined;
            return (
              <EditNoteForm
                key={note.formId}
                className={noteFormClassName}
                formId={note.formId}
                note={note.note}
                saveState={note.saveState}
                saveError={note.saveError ? note.saveError.message : undefined}
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
        <div className="notecontainer" ref={this.deletingNotesContainerRef}>
          {this.state.deletingNotes.map((note, i) => (
            <EditNoteForm
              key={note.formId}
              className={noteFormClassName}
              formId={note.formId}
              note={note.note}
              saveState={note.saveState}
              saveError={note.saveError ? note.saveError.message : undefined}
              relatedKeywords={this.props.keywords}
              onChange={this.handleNoteChange}
              onDelete={this.props.onDeleteNote}
            />
          ))}
        </div>
      </div>
    );
  }
}
