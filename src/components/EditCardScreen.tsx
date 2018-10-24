import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';

import { Card, Note } from '../model';
import EditCardToolbar from './EditCardToolbar';
import EditCardForm from './EditCardForm';
import EditCardNotFound from './EditCardNotFound';
import DynamicNoteList from './DynamicNoteList';
import { FormState } from '../edit/FormState';
import * as editActions from '../edit/actions';
import { EditFormState, EditState } from '../edit/reducer';
import { hasDataToSave } from '../edit/selectors';
import * as routeActions from '../route/actions';
import { EditScreenContext } from '../notes/actions';

interface Props {
  forms: {
    active: EditFormState;
  };
  active: boolean;
  onEdit: (formId: number, change: Partial<Card>) => void;
  onDelete: (formId: number, cardId?: string) => void;
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
    };
  }

  activeFormRef: React.RefObject<EditCardForm>;

  constructor(props: Props) {
    super(props);

    this.activeFormRef = React.createRef<EditCardForm>();

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount() {
    if (this.props.active) {
      this.focusIfNew();
    }
  }

  componentDidUpdate(previousProps: Props) {
    // If we are newly active, or if we've just changed cards (e.g. by creating
    // a new card) then focus the card if it's new.
    if (
      (this.props.active && previousProps.active !== this.props.active) ||
      previousProps.forms.active.formId !== this.props.forms.active.formId
    ) {
      this.focusIfNew();
    }
  }

  isFormEmpty(): boolean {
    return (
      this.props.forms.active.formState === FormState.Ok &&
      !hasDataToSave(this.props.forms.active.card)
    );
  }

  focusIfNew() {
    if (this.isFormEmpty() && this.activeFormRef.current) {
      this.activeFormRef.current.focus();
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

  render() {
    const keywords = this.props.forms.active.card.keywords || [];

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
              key={`card-${this.props.forms.active.formId}`}
            />
            <hr className="note-divider divider" />
            <DynamicNoteList
              context={
                {
                  screen: 'edit-card',
                  cardFormId: this.props.forms.active.formId,
                } as EditScreenContext
              }
              notes={this.props.forms.active.notes}
              keywords={keywords}
              priority="writing"
              className="notes"
              key={`notes-${this.props.forms.active.formId}`}
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
});

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(EditCardScreen);
