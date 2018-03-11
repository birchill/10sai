import React from 'react';
import PropTypes from 'prop-types';
import { Dispatch, connect } from 'react-redux';

import { Card } from '../model';
import EditCardToolbar from './EditCardToolbar.jsx';
import EditCardForm from './EditCardForm';
import EditCardNotFound from './EditCardNotFound.jsx';
import EditState from '../edit/states';
import * as editActions from '../edit/actions';
import * as routeActions from '../route/actions';
import TagSuggester from '../edit/TagSuggester';

type FormId = number | string;

interface Form {
  formId: FormId;
  editState: Symbol;
  card: Partial<Card>;
  deleted?: boolean;
}

interface Props {
  tagSuggester: TagSuggester;
  forms: {
    active: Form;
  };
  active: boolean;
  onEdit: (id: FormId, change: Partial<Card>) => void;
  onDelete: (id: FormId) => void;
}

export class EditCardScreen extends React.PureComponent<Props> {
  activeForm?: EditCardForm;

  static get propTypes() {
    return {
      tagSuggester: PropTypes.instanceOf(TagSuggester).isRequired,
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.any,
          editState: PropTypes.symbol.isRequired,
          // eslint-disable-next-line react/forbid-prop-types
          card: PropTypes.object.isRequired,
          deleted: PropTypes.bool,
        }).isRequired,
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired,
    };
  }

  constructor(props: Props) {
    super(props);

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
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
      this.props.forms.active.editState === EditState.EMPTY &&
      this.activeForm &&
      this.activeForm.questionTextBox
    ) {
      this.activeForm.questionTextBox.focus();
    }
  }

  handleFormChange<K extends keyof Card>(field: K, value: Card[K]) {
    this.props.onEdit(this.props.forms.active.formId, { [field]: value });
  }

  handleDelete() {
    this.props.onDelete(this.props.forms.active.formId);
  }

  render() {
    return (
      <section className="edit-screen" aria-hidden={!this.props.active}>
        <EditCardToolbar
          editState={this.props.forms.active.editState}
          onDelete={this.handleDelete}
        />
        {this.props.forms.active.editState !== EditState.NOT_FOUND ? (
          <EditCardForm
            tagSuggester={this.props.tagSuggester}
            onChange={this.handleFormChange}
            {...this.props.forms.active}
            ref={activeForm => {
              this.activeForm = activeForm || undefined;
            }}
          />
        ) : (
          <EditCardNotFound deleted={this.props.forms.active.deleted} />
        )}
      </section>
    );
  }
}

// XXX Use some sort of EditState type here once we convert the reducer to TS
const mapStateToProps = (state: any) => ({
  forms: state.edit.forms,
});
const mapDispatchToProps = (dispatch: Dispatch<any>) => ({
  onEdit: (formId: FormId, card: Partial<Card>) => {
    dispatch(editActions.editCard(formId, card));
  },
  onDelete: (formId: FormId) => {
    dispatch(editActions.deleteEditCard(formId));
    dispatch(routeActions.followLink('/'));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(EditCardScreen);
