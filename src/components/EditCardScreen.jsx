import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import EditCardToolbar from './EditCardToolbar.jsx';
import EditCardForm from './EditCardForm.jsx';
import EditCardNotFound from './EditCardNotFound.jsx';
import EditState from '../edit-states';
import * as editActions from '../actions/edit';

export class EditCardScreen extends React.Component {
  static get propTypes() {
    return {
      forms: PropTypes.shape({
        active: PropTypes.shape({
          formId: PropTypes.any,
          editState: PropTypes.symbol.isRequired,
          card: PropTypes.object,
        }).isRequired
      }),
      active: PropTypes.bool.isRequired,
      onEdit: PropTypes.func.isRequired,
      onClose: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleClose = this.handleClose.bind(this);
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

  handleClose(doClose) {
    this.props.onClose(this.props.forms.active.formId, doClose);
  }

  render() {
    return (
      <section
        className="edit-screen"
        aria-hidden={!this.props.active} >
        <EditCardToolbar
          editState={this.props.forms.active.editState}
          onClose={this.handleClose} />
        { this.props.forms.active.editState !== EditState.NOT_FOUND
          ? <EditCardForm
            active={this.props.active}
            onChange={this.handleFormChange}
            {...this.props.forms.active} />
          : <EditCardNotFound /> }
      </section>
    );
  }
}

const mapStateToProps = state => ({
  forms: state.edit.forms,
});
const mapDispatchToProps = dispatch => ({
  onEdit: (formId, card) => { dispatch(editActions.editCard(formId, card)); },
  onClose: (formId, doClose) => {
    dispatch(editActions.saveEditCard(formId, doClose));
  },
});

export default connect(mapStateToProps, mapDispatchToProps)(EditCardScreen);
