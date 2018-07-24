import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import { Card, Note } from '../model';
import EditCardToolbar from './EditCardToolbar';
import EditCardForm from './EditCardForm';
import EditCardNotFound from './EditCardNotFound';
import NoteList from './NoteList';
import { FormState } from '../edit/FormState';
import * as editActions from '../edit/actions';
import { EditFormState, EditState } from '../edit/reducer';
import { hasDataToSave } from '../edit/selectors';
import * as noteActions from '../notes/actions';
import * as routeActions from '../route/actions';

interface Props {
  forms: {
    active: EditFormState;
  };
  active: boolean;
  onEdit: (formId: number, change: Partial<Card>) => void;
  onDelete: (formId: number, cardId?: string) => void;
  onAddNote: (formId: number, initialKeywords: string[]) => void;
  onNoteChange: (
    cardFormId: number,
    noteFormId: number,
    change: Partial<Note>
  ) => void;
}

export class EditCardScreen extends React.PureComponent<Props> {
  static get propTypes() {
    return {
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.number.isRequired,
          formState: PropTypes.string.isRequired,
          card: PropTypes.object.isRequired,
          notes: PropTypes.arrayOf(
            PropTypes.shape({
              formId: PropTypes.number,
              note: PropTypes.object.isRequired,
              dirtyFields: PropTypes.instanceOf(Set),
              saveState: PropTypes.string.isRequired,
              saveError: PropTypes.object,
            })
          ),
          saveError: PropTypes.object,
        }).isRequired,
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired,
      onAddNote: PropTypes.func.isRequired,
    };
  }

  activeFormRef: React.RefObject<EditCardForm>;

  constructor(props: Props) {
    super(props);

    this.activeFormRef = React.createRef<EditCardForm>();

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
    this.handleAddNote = this.handleAddNote.bind(this);
    this.handleNoteChange = this.handleNoteChange.bind(this);
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
  }

  isFormEmpty(): boolean {
    return (
      this.props.forms.active.formState === FormState.Ok &&
      !hasDataToSave(this.props.forms.active.card)
    );
  }

  activate() {
    if (
      this.isFormEmpty() &&
      this.activeFormRef.current &&
      this.activeFormRef.current.questionTextBoxRef.current
    ) {
      this.activeFormRef.current.questionTextBoxRef.current.focus();
    }
  }

  handleFormChange<K extends keyof Card>(field: K, value: Card[K]) {
    this.props.onEdit(this.props.forms.active.formId, { [field]: value });
  }

  handleDelete() {
    this.props.onDelete(
      this.props.forms.active.formId,
      this.props.forms.active.card._id
    );
  }

  handleAddNote(initialKeywords: Array<string>) {
    this.props.onAddNote(this.props.forms.active.formId, initialKeywords);
  }

  handleNoteChange(noteFormId: number, change: Partial<Note>) {
    this.props.onNoteChange(this.props.forms.active.formId, noteFormId, change);
  }

  render() {
    const relatedKeywords = this.props.forms.active.card.keywords || [];

    const canDelete =
      this.props.forms.active.formState === FormState.Ok && !this.isFormEmpty();

    return (
      <section className="edit-screen" aria-hidden={!this.props.active}>
        <EditCardToolbar canDelete={canDelete} onDelete={this.handleDelete} />
        {this.props.forms.active.formState !== FormState.NotFound &&
        this.props.forms.active.formState !== FormState.Deleted ? (
          <>
            <EditCardForm
              onChange={this.handleFormChange}
              {...this.props.forms.active}
              ref={this.activeFormRef}
            />
            <hr className="note-divider divider" />
            <NoteList
              notes={this.props.forms.active.notes}
              relatedKeywords={relatedKeywords}
              onAddNote={this.handleAddNote}
              onNoteChange={this.handleNoteChange}
            />
          </>
        ) : (
          <EditCardNotFound
            deleted={this.props.forms.active.formState === FormState.Deleted}
          />
        )}
      </section>
    );
  }
}

// XXX Use the actual state once we have it
type State = any;

const mapStateToProps = (state: State) => ({
  forms: (state.edit as EditState).forms,
});
const mapDispatchToProps = (dispatch: Dispatch<State>) => ({
  onEdit: (formId: number, change: Partial<Card>) => {
    dispatch(editActions.editCard(formId, change));
  },
  onDelete: (formId: number, cardId?: string) => {
    dispatch(editActions.deleteCard(formId, cardId));
    dispatch(routeActions.followLink('/'));
  },
  onAddNote: (formId: number, initialKeywords: string[]) => {
    dispatch(
      noteActions.addNote(
        { screen: 'edit-card', cardFormId: formId },
        initialKeywords
      )
    );
  },
  onNoteChange: (
    cardFormId: number,
    noteFormId: number,
    change: Partial<Note>
  ) => {
    dispatch(
      noteActions.editNote(
        { screen: 'edit-card', cardFormId, noteFormId },
        change
      )
    );
  },
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditCardScreen);
