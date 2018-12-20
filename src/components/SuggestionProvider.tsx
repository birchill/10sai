import * as React from 'react';

import { SuggestionResult } from '../suggestions/SuggestionResult';
import { debounce } from '../utils';

export interface SuggestionProviderProps {
  text?: string;
  children: (
    suggestions: string[],
    loading: boolean,
    addRecentEntry: (entry: string) => void
  ) => React.ReactNode;
}

export interface State {
  suggestions: string[];
  loading: boolean;
}

export abstract class SuggestionProvider<
  Props extends SuggestionProviderProps = SuggestionProviderProps
> extends React.Component<Props, State> {
  state: State;
  updateSeq: number = 0;
  debouncedUpdate: () => void;

  constructor(props: Props) {
    super(props);

    this.state = {
      suggestions: [],
      loading: false,
    };

    this.debouncedUpdate = debounce(this.updateSuggestions, 200).bind(this);
  }

  componentDidMount() {
    this.updateSuggestions();
  }

  suggestionsNeedUpdate(prevProps: Props): boolean {
    return prevProps.text !== this.props.text;
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!this.suggestionsNeedUpdate(prevProps)) {
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

  abstract getSuggestions(): SuggestionResult;
  abstract get addRecentEntry(): (entry: string) => void;

  updateSuggestions() {
    const result = this.getSuggestions();
    const thisUpdate = ++this.updateSeq;

    const updatedState: Partial<State> = {};
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
