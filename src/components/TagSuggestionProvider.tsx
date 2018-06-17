import React from 'react';
import PropTypes from 'prop-types';
import TagSuggesterContext from './TagSuggesterContext';
import { debounce } from '../utils';
import { TagSuggester } from '../suggestions/TagSuggester';

interface Props {
  text?: string;
  children: (
    suggestions: string[],
    loading: boolean,
    addRecentEntry: (entry: string) => void
  ) => React.ReactNode;
}

interface PropsInner extends Props {
  tagSuggester: TagSuggester;
}

interface StateInner {
  suggestions: string[];
  loading: boolean;
}

class TagSuggestionProviderInner extends React.Component<PropsInner> {
  static get propTypes() {
    return {
      text: PropTypes.string.isRequired,
      children: PropTypes.func.isRequired,
      tagSuggester: PropTypes.object.isRequired,
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
    this.addRecentEntry = props.tagSuggester.recordRecentTag.bind(
      props.tagSuggester
    );
  }

  componentDidMount() {
    this.updateSuggestions();
  }

  componentDidUpdate(prevProps: PropsInner, prevState: StateInner) {
    if (prevProps.text === this.props.text) {
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
    const result = this.props.tagSuggester.getSuggestions(
      this.props.text || ''
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

// See KeywordSuggestionProvider for rationale for taking a possibly
// undefined TagSuggester then asserting it is defined.
export const TagSuggestionProvider = (props: Props) => (
  <TagSuggesterContext.Consumer>
    {(tagSuggester?: TagSuggester) => (
      <TagSuggestionProviderInner {...props} tagSuggester={tagSuggester!} />
    )}
  </TagSuggesterContext.Consumer>
);

export default TagSuggestionProvider;
