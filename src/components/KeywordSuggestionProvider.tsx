import React from 'react';
import PropTypes from 'prop-types';
import KeywordSuggesterContext from './KeywordSuggesterContext';
import { debounce } from '../utils';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';
import {
  KeywordSuggester,
  RecentKeywordHandling,
} from '../suggestions/KeywordSuggester';

interface Props {
  text?: string;
  defaultSuggestions?: string[];
  includeRecentKeywords?: boolean;
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
      defaultSuggestions: PropTypes.arrayOf(PropTypes.string),
      includeRecentKeywords: PropTypes.bool,
      children: PropTypes.func.isRequired,
      keywordSuggester: PropTypes.object.isRequired,
    };
  }

  state: StateInner = {
    suggestions: [],
    loading: false,
  };
  updateSeq: number = 0;
  debouncedUpdate: () => void;
  addRecentEntry: (entry: string) => void;

  constructor(props: PropsInner) {
    super(props);

    this.debouncedUpdate = debounce(this.updateSuggestions, 200).bind(this);
    this.addRecentEntry = props.keywordSuggester.recordAddedKeyword.bind(
      props.keywordSuggester
    );
  }

  componentDidMount() {
    this.updateSuggestions();
  }

  componentDidUpdate(prevProps: PropsInner, prevState: StateInner) {
    // First check if something we care about changed.
    if (
      shallowEqual(
        prevProps.defaultSuggestions,
        this.props.defaultSuggestions
      ) &&
      prevProps.text === this.props.text
    ) {
      return;
    }

    // Check if we need to do an immediate update:
    //
    // If we have no text we need to update immediately since either the default
    // suggestions changed or we are newly without text.
    if (!this.props.text) {
      this.updateSuggestions();
      return;
    }

    // We have text, if it changed (as opposed to changes to the default
    // suggestions) then do a debounced update.
    if (prevProps.text !== this.props.text) {
      // We only need to debounce when doing a text-lookup but we call the
      // debounced version in both cases since otherwise we can end up with the
      // non-debounced version racing with the debounced version (unless we
      // actually cancel the debounced one when doing a non-text lookup).
      this.debouncedUpdate();
    }
  }

  componentWillUnmount() {
    // Cause any outstanding async requests to be ignored when they return.
    this.updateSeq = Infinity;
  }

  updateSuggestions() {
    const result = this.props.keywordSuggester.getSuggestions(
      this.props.text || '',
      this.props.defaultSuggestions || [],
      !!this.props.includeRecentKeywords
        ? RecentKeywordHandling.Include
        : RecentKeywordHandling.Omit
    );
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
