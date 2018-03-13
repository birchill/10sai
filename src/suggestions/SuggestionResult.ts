// Result of a call to getSuggestions()
//
// At least one of |initialResult| or |asyncResult| must be set.
export interface SuggestionResult {
  // If set, provides the result that could be determined synchronously.
  // If |asyncResult| is also set, the value of |asyncResult| is guaranteed to
  // be an extension of |initialResult|, i.e. elements are only appended to
  // |initialResult|.
  initialResult?: string[];

  // If set, indicates that an asynchronous lookup is being performed. Once
  // complete, the result of the asynchronous lookup is returned.
  // If a subsequent call to getSuggestions is made while the lookup is in
  // progress, the Promise will be rejected.
  asyncResult?: Promise<string[]>;
}
