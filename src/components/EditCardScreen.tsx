import * as React from 'react';
import { Dispatch } from 'redux';
import { connect } from 'react-redux';
import DocumentTitle from 'react-document-title';

import { Card } from '../model';
import * as Actions from '../actions';
import { AppState } from '../reducer';
import { FormState } from '../edit/FormState';
import { EditFormState, EditState } from '../edit/reducer';
import { hasDataToSave } from '../edit/selectors';
import { EditScreenContext } from '../notes/actions';
import { getKeywordVariants } from '../text/keywords';
import { toPlainText } from '../text/rich-text';
import { stripRuby } from '../text/ruby';
import { Return } from '../utils/type-helpers';

import { EditCardToolbar } from './EditCardToolbar';
import { EditCardForm } from './EditCardForm';
import { EditCardNotFound } from './EditCardNotFound';
import { DynamicNoteList } from './DynamicNoteList';

interface Props {
  active: boolean;
}

interface PropsInner extends Props {
  forms: {
    active: EditFormState;
  };
  onEdit: (formId: number, change: Partial<Card>) => void;
  onDelete: (formId: number, cardId?: string) => void;
}

class EditCardScreenInner extends React.PureComponent<PropsInner> {
  activeFormRef: React.RefObject<EditCardForm>;

  constructor(props: PropsInner) {
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

  componentDidUpdate(previousProps: PropsInner) {
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
      this.props.forms.active.card.id
    );
  }

  render() {
    const { card } = this.props.forms.active;
    const keywords = card.keywords
      ? [...card.keywords, ...getKeywordVariants(card.keywords)]
      : [];

    const canDelete =
      this.props.forms.active.formState === FormState.Ok && !this.isFormEmpty();
    const { formId, formState, notes } = this.props.forms.active;

    return (
      <section className="edit-screen" aria-hidden={!this.props.active}>
        {this.renderTitle()}
        <EditCardToolbar canDelete={canDelete} onDelete={this.handleDelete} />
        {formState !== FormState.NotFound && formState !== FormState.Deleted ? (
          <>
            <EditCardForm
              onChange={this.handleFormChange}
              onDelete={this.handleDelete}
              canDelete={canDelete}
              {...this.props.forms.active}
              ref={this.activeFormRef}
              key={`card-${formId}`}
            />
            <hr className="note-divider divider" />
            <DynamicNoteList
              noteListContext={
                {
                  screen: 'edit-card',
                  cardFormId: formId,
                } as EditScreenContext
              }
              notes={notes}
              keywords={keywords}
              priority="writing"
              className="notes"
              key={`notes-${formId}`}
            />
          </>
        ) : (
          <EditCardNotFound deleted={formState === FormState.Deleted} />
        )}
      </section>
    );
  }

  renderTitle(): React.ReactNode | null {
    if (!this.props.active) {
      return null;
    }

    let subtitle: string = 'Edit card';

    switch (this.props.forms.active.formState) {
      case FormState.NotFound:
        subtitle = 'Card not found';
        break;

      case FormState.Deleted:
        subtitle = 'Card deleted';
        break;

      case FormState.Loading:
        subtitle = 'Card loading...';
        break;

      case FormState.Ok:
        {
          const { card } = this.props.forms.active;
          if (!card.front) {
            subtitle = 'New card';
          } else {
            subtitle = stripRuby(toPlainText(card.front));
          }
        }
        break;
    }

    return <DocumentTitle title={`10sai - ${subtitle}`} />;
  }
}

const mapStateToProps = (state: AppState) => ({
  forms: (state.edit as EditState).forms,
});

const mapDispatchToProps = (dispatch: Dispatch<Actions.Action>) => ({
  onEdit: (formId: number, change: Partial<Card>) => {
    dispatch(Actions.editCard(formId, change));
  },
  onDelete: (formId: number, cardId?: string) => {
    dispatch(Actions.deleteCard(formId, cardId));
    dispatch(Actions.followLink('/'));
  },
});

export const EditCardScreen = connect<
  Return<typeof mapStateToProps>,
  Return<typeof mapDispatchToProps>,
  Props,
  AppState
>(
  mapStateToProps,
  mapDispatchToProps
)(EditCardScreenInner);
