import * as React from 'react';
import { DataStore } from '../store/DataStore';

export const DataStoreContext = React.createContext<DataStore | undefined>(
  undefined
);
