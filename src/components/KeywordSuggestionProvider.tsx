import React from 'react';
import PropTypes from 'prop-types';
import DataStoreContext from './DataStoreContext';
import KeywordSuggester from '../suggestions/KeywordSuggester';
import { debounce } from '../utils';
import { Card } from '../model';
import { DataStore } from '../store/DataStore';

interface Props {
  text?: string;
  card?: Partial<Card>;
  children: (suggestions: string[], loading: boolean) => React.ReactNode;
}

interface PropsInner extends Props {
  dataStore?: DataStore;
}

interface StateInner {
  suggestions: string[];
  loading: boolean;
}

class KeywordSuggestionProviderInner extends React.Component<PropsInner> {
  state: StateInner = {
    suggestions: [],
    loading: false,
  };
  updateSeq: number = 0;

  keywordSuggester: KeywordSuggester | null;
  debouncedUpdate: (input: string | Partial<Card>) => void;

  static get propTypes() {
    return {
      text: PropTypes.string.isRequired,
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object,
      children: PropTypes.func.isRequired,
      dataStore: PropTypes.object,
    };
  }

  constructor(props: PropsInner) {
    super(props);

    if (props.dataStore) {
      this.keywordSuggester = new KeywordSuggester(props.dataStore);
    }

    this.debouncedUpdate = debounce(this.updateSuggestions, 200).bind(this);
  }

  componentDidMount() {
    this.updateSuggestions(this.props.text || this.props.card || '');
  }

  componentDidUpdate(prevProps: PropsInner, prevState: StateInner) {
    // First check if something we care about changed.
    //
    // (This first check is a mess but we'll soon replace it.)
    const cardDataIsEqual =
      typeof prevProps.card === typeof this.props.card &&
      ((prevProps.card &&
        prevProps.card!.question === this.props.card!.question &&
        prevProps.card!.answer === this.props.card!.answer) ||
        !prevProps.card);
    if (cardDataIsEqual && prevProps.text === this.props.text) {
      return;
    }

    // Check if we need to do an immediate update:
    //
    // If we have no text we need to update immediately since either the card
    // changed or we are newly without text.
    if (!this.props.text) {
      const cardHasText = (card?: Partial<Card>) =>
        card && (card.question || card.answer);
      if (cardHasText(this.props.card)) {
        this.updateSuggestions(this.props.card!);
      } else {
        this.setState({ suggestions: [], loading: false });
      }
      return;
    }

    // We have text, if it changed (as opposed to an underlying card change)
    // then do a debounced update.
    if (prevProps.text !== this.props.text) {
      // We only need to debounce when doing a text-lookup but we call the
      // debounced version in both cases since otherwise we can end up with the
      // non-debounced version racing with the debounced version (unless we
      // actually cancel the debounced one when doing a non-text lookup).
      this.debouncedUpdate(this.props.text || this.props.card || '');
    }
  }

  componentWillUnmount() {
    // Cause any outstanding async requests to be ignored when they return.
    this.updateSeq = Infinity;
  }

  updateSuggestions(input: string | Partial<Card>) {
    // XXX What to do about this case
    if (!this.keywordSuggester) {
      return;
    }

    const result = this.keywordSuggester.getSuggestions(input);
    const thisUpdate = ++this.updateSeq;

    const updatedState: Partial<StateInner> = {};
    if (result.initialResult) {
      updatedState.suggestions = result.initialResult;
    }
    updatedState.loading = !!result.asyncResult;

    // The typings for setState are just messed up.
    this.setState(updatedState as any);

    if (result.asyncResult) {
      result.asyncResult
        .then(suggestions => {
          // Check there hasn't been a more recent update.
          if (this.updateSeq !== thisUpdate) {
            return;
          }

          // Again, setState typings
          this.setState({ suggestions, loading: false } as any);
        })
        .catch(() => {
          /* Ignore, request was canceled. */
        });
    }
  }

  render() {
    return this.props.children(this.state.suggestions, this.state.loading);
  }
}

export const KeywordSuggestionProvider = (props: Props) => (
  <DataStoreContext.Consumer>
    {(dataStore?: DataStore) => (
      <KeywordSuggestionProviderInner {...props} dataStore={dataStore} />
    )}
  </DataStoreContext.Consumer>
);

export default KeywordSuggestionProvider;
