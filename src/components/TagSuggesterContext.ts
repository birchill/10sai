import * as React from 'react';
import { TagSuggester } from '../suggestions/TagSuggester';

export const TagSuggesterContext = React.createContext<
  TagSuggester | undefined
>(undefined);
