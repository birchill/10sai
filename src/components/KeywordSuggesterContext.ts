import * as React from 'react';

import { KeywordSuggester } from '../suggestions/KeywordSuggester';

export const KeywordSuggesterContext = React.createContext<
  KeywordSuggester | undefined
>(undefined);
