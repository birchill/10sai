import * as React from 'react';

import { KeywordSuggesterContext } from './KeywordSuggesterContext';
import {
  SuggestionProvider,
  SuggestionProviderProps,
} from './SuggestionProvider';
import shallowEqual from 'react-redux/lib/utils/shallowEqual';
import { SuggestionResult } from '../suggestions/SuggestionResult';
import {
  KeywordSuggester,
  RecentKeywordHandling,
} from '../suggestions/KeywordSuggester';

interface Props extends SuggestionProviderProps {
  defaultSuggestions?: string[];
  includeRecentKeywords?: boolean;
}

interface PropsInner extends Props {
  keywordSuggester: KeywordSuggester;
}

class KeywordSuggestionProviderInner extends SuggestionProvider<PropsInner> {
  addRecentEntry: (entry: string) => void;

  constructor(props: PropsInner) {
    super(props);

    this.addRecentEntry = props.keywordSuggester.recordRecentKeyword.bind(
      props.keywordSuggester
    );
  }

  suggestionsNeedUpdate(prevProps: PropsInner): boolean {
    return (
      !shallowEqual(
        prevProps.defaultSuggestions,
        this.props.defaultSuggestions
      ) || prevProps.text !== this.props.text
    );
  }

  getSuggestions(): SuggestionResult {
    return this.props.keywordSuggester.getSuggestions(
      this.props.text || '',
      this.props.defaultSuggestions || [],
      !!this.props.includeRecentKeywords
        ? RecentKeywordHandling.Include
        : RecentKeywordHandling.Omit
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
