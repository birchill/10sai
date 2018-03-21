import DataStore from '../store/DataStore';
import { LRUMap } from '../utils/lru';
import { SuggestionResult } from './SuggestionResult';
import { findSubstringMatch, mergeAndTrimSuggestions } from './utils';
import { Card } from '../model';
import { stripRuby } from '../text/ruby';
import { extractKeywordsFromCloze } from '../text/cloze';
import {
  isKana,
  matchesCharacterClasses,
  CharacterClass,
} from '../text/japanese';

const MAX_SESSION_KEYWORDS = 3;
const MAX_SUGGESTIONS = 6;
const LOOKUP_CACHE_SIZE = 15;

interface KeywordSuggesterOptions {
  maxSessionKeywords?: number;
  maxSuggestions?: number;
}

export class KeywordSuggester {
  store: DataStore;

  // Keywords that have been *entered* (i.e. added to cards) this session.
  sessionKeywords: LRUMap<string, undefined>;

  // The string we may be doing a lookup for or the Card we are guessing from.
  currentInput?: Partial<Card> | string;

  // Cache of keywords we have looked up.
  lookupCache: LRUMap<string, string[]>;

  // The maximum number of initial suggestions to display based on keywords that
  // have already been added in this session.
  maxSessionKeywords: number;

  // The total maximum number of suggestions to return.
  maxSuggestions: number;

  constructor(store: DataStore, options?: KeywordSuggesterOptions) {
    this.store = store;

    this.maxSessionKeywords =
      options && typeof options.maxSessionKeywords !== 'undefined'
        ? options.maxSessionKeywords
        : MAX_SESSION_KEYWORDS;
    this.maxSuggestions = Math.max(
      options && typeof options.maxSuggestions !== 'undefined'
        ? options.maxSuggestions
        : MAX_SUGGESTIONS,
      this.maxSessionKeywords
    );

    this.sessionKeywords = new LRUMap(this.maxSessionKeywords);
    this.lookupCache = new LRUMap(LOOKUP_CACHE_SIZE);

    // Whenever there is change to the cards or notes, our cached keyword
    // lookups might be wrong so drop them.
    this.store.changes.on('card', () => {
      this.lookupCache.clear();
    });
    // XXX Uncomment this once we implement notes!
    /*
    this.store.changes.on('note', () => {
      this.lookupCache.clear();
    });
     */
  }

  recordAddedKeyword(keyword: string) {
    this.sessionKeywords.set(keyword, undefined);
  }

  getSuggestions(input: Partial<Card> | string): SuggestionResult {
    const result: SuggestionResult = {};

    this.currentInput = input;

    // When there is no input we return keywords based on the content and also
    // keywords that have been used recently in this session (e.g. for when
    // you're adding a number of cards around the same word).
    if (typeof input === 'object') {
      // Try guessing from the card contents
      const guessedKeywords: string[] = this.getSuggestionsFromCard(input);

      // Add as many session keywords as we have
      const sessionKeywords: string[] = [
        ...this.sessionKeywords.keys(),
      ].reverse();

      result.initialResult = mergeAndTrimSuggestions(
        guessedKeywords,
        sessionKeywords,
        this.maxSuggestions
      );
      return result;
    }

    // If we have a hit on the cache, return synchronously.
    const substringMatch = findSubstringMatch(
      input,
      this.lookupCache,
      this.maxSuggestions
    );
    if (substringMatch) {
      result.initialResult = substringMatch;
      return result;
    }

    result.asyncResult = new Promise<string[]>((resolve, reject) => {
      this.store.getKeywords(input, this.maxSuggestions).then(keywords => {
        this.lookupCache.set(input, keywords);

        if (this.currentInput !== input) {
          reject(new Error('AbortError'));
        }

        resolve(keywords);
      });
    });

    return result;
  }

  getSuggestionsFromCard(card: Partial<Card>): string[] {
    if (!card.question || !card.answer) {
      return [];
    }

    const question = stripRuby(card.question);
    const answer = stripRuby(card.answer);

    // Look for a cloze -- if we find some stop there.
    const clozeKeywords = extractKeywordsFromCloze(question, answer);
    if (clozeKeywords.length) {
      return clozeKeywords;
    }

    const result = [];
    const answerFirstLine = answer.split('\n')[0];

    // Japanese-specific check #1:
    //
    // If the question is kanji + kana and the first line of the
    // answer is kana it's probably a card testing the kanji reading so
    // use the question.
    if (
      matchesCharacterClasses(
        question,
        CharacterClass.Kanji | CharacterClass.Kana
      ) &&
      isKana(answerFirstLine)
    ) {
      // We could try to extract the kanji parts of the answer (e.g. so that if
      // we have 駐屯する we suggest only 駐屯) but sometimes we actually want
      // the kana parts (e.g. we want the trailing し in 眼差し).
      //
      // In future we should probably use a dictionary lookup to improve this.
      result.push(question);
      // TODO: Add kanji components here
      return result;
    }

    // If the first line of the answer is a single, shortish word then treat
    // that as the answer.
    if (answerFirstLine.length < 20 && !/\s/.test(answerFirstLine)) {
      result.push(answerFirstLine);
    }

    return result;
  }
}

export default KeywordSuggester;
