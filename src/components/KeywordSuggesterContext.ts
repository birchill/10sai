import React from 'react';
import { KeywordSuggester } from '../suggestions/KeywordSuggester';

export const KeywordSuggesterContext = React.createContext<
  KeywordSuggester | undefined
>(undefined);

export default KeywordSuggesterContext;
