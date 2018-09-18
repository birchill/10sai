import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { TokenList } from './TokenList';

storiesOf('Components|TokenList', module)
  .add('default', () => (
    <>
      <div className="row">
        <TokenList
          placeholder="Tags"
          tokens={['漢字', 'N1']}
          suggestions={['Abc', 'テスト']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
      <div className="row">
        <TokenList
          placeholder="Tags"
          tokens={[
            'Many',
            'many',
            'many many many many',
            'tags',
            'Oh yeah, tags',
            'Lots of tags',
            "So many tags we'll need a new row",
            'And a few',
            'more',
            'tags!',
          ]}
          suggestions={['Abc', 'テスト']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
      <div className="row">
        <TokenList
          placeholder="Tags"
          tokens={['Tag']}
          suggestions={[
            'Many',
            'suggestions.',
            'So',
            'many',
            'suggestions that',
            "we'll need a new row",
            "and let's see how these suggestions",
            'wrap properly at that point',
          ]}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
    </>
  ))
  .add('empty', () => (
    <TokenList
      placeholder="Empty state example"
      onTokensChange={action('onTokensChange')}
      onTextChange={action('onTextChange')}
    />
  ))
  .add('loading', () => (
    <>
      <div className="row">
        <TokenList
          placeholder="Loading example (no suggestions)"
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
          loadingSuggestions={true}
        />
      </div>
      <div className="row">
        <TokenList
          placeholder="Loading example (with suggestions)"
          suggestions={['Suggestion 1', 'Suggestion 2']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
          loadingSuggestions={true}
        />
      </div>
    </>
  ))
  .add('linked', () => (
    <TokenList
      placeholder="Linked example"
      tokens={['Linked', 'Not linked']}
      linkedTokens={['Linked']}
      linkedTooltip="This token is linked"
      onTokensChange={action('onTokensChange')}
      onTextChange={action('onTextChange')}
    />
  ))
  .add('yellow', () => (
    <>
      <div className="row">
        <TokenList
          className="-yellow"
          placeholder="Empty"
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
      <div className="row">
        <TokenList
          className="-yellow"
          placeholder="With tokens"
          tokens={['漢字', 'N1']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
      <div className="row">
        <TokenList
          className="-yellow"
          placeholder="With tokens and suggestions"
          tokens={['漢字', 'N1']}
          suggestions={['Suggestion']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
        />
      </div>
      <div className="row">
        <TokenList
          className="-yellow"
          placeholder="Loading (no suggestions)"
          tokens={['漢字', 'N1']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
          loadingSuggestions={true}
        />
      </div>
      <div className="row">
        <TokenList
          className="-yellow"
          placeholder="Loading (with suggestions)"
          tokens={['漢字', 'N1']}
          suggestions={['Suggestion']}
          onTokensChange={action('onTokensChange')}
          onTextChange={action('onTextChange')}
          loadingSuggestions={true}
        />
      </div>
      <TokenList
        className="-yellow"
        placeholder="With linked tag"
        tokens={['Linked', 'Not linked']}
        linkedTokens={['Linked']}
        linkedTooltip="This token is linked"
        onTokensChange={action('onTokensChange')}
        onTextChange={action('onTextChange')}
      />
    </>
  ));
