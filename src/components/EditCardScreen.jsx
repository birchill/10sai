import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import EditCardToolbar from './EditCardToolbar.jsx';
import EditCardForm from './EditCardForm.jsx';
import EditCardNotFound from './EditCardNotFound.jsx';
import EditState from '../edit-states';
import * as editActions from '../actions/edit';
import * as routeActions from '../actions/route';

export class EditCardScreen extends React.Component {
  static get propTypes() {
    return {
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.any,
          editState: PropTypes.symbol.isRequired,
          card: PropTypes.object,
          deleted: PropTypes.bool,
        }).isRequired,
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onDelete: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount() {
    if (this.props.active) this.activate();
  }

  componentDidUpdate(previousProps) {
    if (previousProps.active === this.props.active) {
      return;
    }

    if (this.props.active) {
      this.activate();
    } else {
      this.deactivate();
    }
  }

  componentWillUnmount() {
    if (this.props.active) this.deactivate();
  }

  activate() {
    this.previousFocus = document.activeElement;
  }

  deactivate() {
    if (this.previousFocus) {
      this.previousFocus.focus();
      this.previousFocus = undefined;
    }
  }

  handleFormChange(field, value) {
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
          onDelete={this.handleDelete} />
        {this.props.forms.active.editState !== EditState.NOT_FOUND
          ? <EditCardForm
            active={this.props.active}
            onChange={this.handleFormChange}
            {...this.props.forms.active} />
          : <EditCardNotFound deleted={this.props.forms.active.deleted} />}
      </section>
    );
  }
}

const mapStateToProps = state => ({
  forms: state.edit.forms,
});
const mapDispatchToProps = dispatch => ({
  onEdit: (formId, card) => {
    dispatch(editActions.editCard(formId, card));
  },
  onDelete: formId => {
    dispatch(editActions.deleteEditCard(formId));
    dispatch(routeActions.followLink('/'));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(EditCardScreen);
