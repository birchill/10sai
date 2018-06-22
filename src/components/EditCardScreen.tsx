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
import { EditState, EditFormState, FormId } from '../edit/reducer';
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

  constructor(props: Props) {
    super(props);

    this.activeFormRef = React.createRef<EditCardForm>();
    this.addNoteButtonRef = React.createRef<AddNoteButton>();

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

    this.props.onAddNote(this.props.forms.active.formId, initialKeywords);

    // Animate the transition... assuming we have a button to animate.
    if (!this.addNoteButtonRef.current || !this.addNoteButtonRef.current.elem) {
      return;
    }

    // Check for animations support
    if (typeof this.addNoteButtonRef.current.elem.animate !== 'function') {
      return;
    }

    this.addNoteButtonRef.current.stretchTo({
      width: 400,
      height: 150,
      duration: 300,
      holdDuration: 300,
    });
    this.addNoteButtonRef.current.elem.animate(
      {
        transform: ['translateY(-200px)', 'translateY(-200px)'],
        opacity: [1, 1, 0],
      },
      { duration: 600 }
    );
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
            {this.props.forms.active.notes.map((note, i) => (
              <EditNoteForm
                key={note.note.id || `new-note-i`}
                className="noteform"
                note={note.note}
                relatedKeywords={relatedKeywords}
              />
            ))}
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
