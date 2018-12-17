import * as React from 'react';
import { CardList } from '../CardList';

export const CardListContext = React.createContext<CardList | undefined>(
  undefined
);
