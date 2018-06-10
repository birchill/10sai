import React from 'react';
import PropTypes from 'prop-types';
import KeywordSuggesterContext from './KeywordSuggesterContext';
import { debounce } from '../utils';
import { Card } from '../model';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';

interface Props {
  text?: string;
  card?: Partial<Card>;
  children: (
    suggestions: string[],
    loading: boolean,
    addRecentEntry: (entry: string) => void
  ) => React.ReactNode;
}

interface PropsInner extends Props {
  keywordSuggester: KeywordSuggester;
}

interface StateInner {
  suggestions: string[];
  loading: boolean;
}

class KeywordSuggestionProviderInner extends React.Component<PropsInner> {
  static get propTypes() {
    return {
      text: PropTypes.string.isRequired,
      // eslint-disable-next-line react/forbid-prop-types
      card: PropTypes.object,
      children: PropTypes.func.isRequired,
      keywordSuggester: PropTypes.object.isRequired,
    };
  }

  state: StateInner = {
    suggestions: [],
    loading: false,
  };
  updateSeq: number = 0;
  debouncedUpdate: (input: string | Partial<Card>) => void;
  addRecentEntry: (entry: string) => void;

  constructor(props: PropsInner) {
    super(props);

    this.debouncedUpdate = debounce(this.updateSuggestions, 200).bind(this);
    this.addRecentEntry = props.keywordSuggester.recordAddedKeyword.bind(
      props.keywordSuggester
    );
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
      if (cardHasText(this.props.card) || cardHasText(prevProps.card)) {
        this.updateSuggestions(this.props.card!);
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
    const result = this.props.keywordSuggester.getSuggestions(input);
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
    return this.props.children(
      this.state.suggestions,
      this.state.loading,
      this.addRecentEntry
    );
  }
}

// The (new) React Context API frustratingly requires a default value. I can't
// understand the rationale for this: it greatly complicates all users since if
// a suitable default value cannot be created they are required to handle the
// undefined/null case everywhere the value is used.
//
// In this app we just assert the thing is not undefined and allow the following
// code to be sensible.
export const KeywordSuggestionProvider = (props: Props) => (
  <KeywordSuggesterContext.Consumer>
    {(keywordSuggester?: KeywordSuggester) => (
      <KeywordSuggestionProviderInner
        {...props}
        keywordSuggester={keywordSuggester!}
      />
    )}
  </KeywordSuggesterContext.Consumer>
);

export default KeywordSuggestionProvider;
