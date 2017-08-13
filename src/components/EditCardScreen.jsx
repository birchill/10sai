import React from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import deepEqual from 'deep-equal';

import EditCardToolbar from './EditCardToolbar.jsx';
import EditCardForm from './EditCardForm.jsx';
import EditCardNotFound from './EditCardNotFound.jsx';
import EditState from '../edit-states';
import * as editActions from '../actions/edit';
import { saveEditCardIfNeeded } from '../sagas/edit';

const SAVE_TIMEOUT = 2000;

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
      save: PropTypes.func.isRequired,
    };
  }

  constructor(props) {
    super(props);

    this.state = { saveTimeout: undefined };
    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleClose = this.handleClose.bind(this);
  }

  componentDidMount() {
    if (this.props.active) this.activate();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.forms.active.formId !== nextProps.forms.active.formId) {
      console.assert(typeof this.state.saveTimeout === 'undefined',
                     'Should have finished saving the previous card');
    }

    // If we are newly dirty we should start a timeout for triggering a save.
    // Furthermore, if we were already dirty but the card content has
    // changed (i.e. we're *more* dirty) then we should reset any existing save
    // task we'd scheduled and trigger a new one.
    if (nextProps.forms.active.editState === EditState.DIRTY &&
        (this.props.forms.active.editState
           !== nextProps.forms.active.editState ||
         !deepEqual(this.props.forms.active.card,
                    nextProps.forms.active.card))) {
      if (this.state.saveTimeout) {
        clearTimeout(this.state.saveTimeout);
      }
      const saveTimeout = setTimeout(() => {
        nextProps.save(nextProps.forms.active.formId).catch(err => {
          console.log(err);
        });
        this.setState({ saveTimeout: undefined });
      }, SAVE_TIMEOUT);
      this.setState({ saveTimeout });
    }
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
    saveEditCardIfNeeded(formId, dispatch)
      .then(doClose)
      .catch(err => { console.log(err); });
  },
  save: formId => saveEditCardIfNeeded(formId, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(EditCardScreen);
