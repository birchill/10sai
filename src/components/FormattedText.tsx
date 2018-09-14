import React from 'react';
import PropTypes from 'prop-types';

import { deserialize, Inline } from '../text/rich-text';
import { parseRuby } from '../text/ruby';

interface Props {
  text: string;
}

const FormattedText: React.SFC<Props> = props => {
  const blocks = deserialize(props.text);
  let i = 0;

  return (
    <>
      {blocks.map(block => {
        const key = `block-${i++}`;
        return <p key={key}>{renderChildren(block.children, key)}</p>;
      })}
    </>
  );
};

const styleMapping = new Map<string, string>([
  ['b', 'bold'],
  ['i', 'italic'],
  ['u', 'underline'],
  ['.', 'dotemphasis'],
]);

function renderChildren(
  children: Array<Inline | string>,
  parentKey: string
): React.ReactNode {
  let i = 0;

  return (
    <>
      {children.map(child => {
        const key = `${parentKey}-${i++}`;
        if (typeof child === 'string') {
          return renderRuby(child, key);
        } else {
          const className = child.styles
            .map(style => styleMapping.get(style))
            .join(' ');
          return (
            <span key={key} className={className}>
              {renderChildren(child.children, key)}
            </span>
          );
        }
      })}
    </>
  );
}

function renderRuby(text: string, key: string): React.ReactNode {
  const parts = parseRuby(text);

  // Track how many times each substring occurs so we can assign unique keys
  const keys: {
    [key: string]: number;
  } = {};

  return (
    <React.Fragment key={key}>
      {parts.map(part => {
        // Generate a unique key for the substring
        const keyText =
          typeof part === 'string' ? part : `${part.base}-${part.ruby}`;
        if (keys.hasOwnProperty(keyText)) {
          keys[keyText]++;
        } else {
          keys[keyText] = 0;
        }
        const key = `${keyText}-${keys[keyText]}`;

        if (typeof part === 'string') {
          return <span key={key}>{part}</span>;
        } else {
          return (
            <ruby key={key}>
              {part.base}
              <rt>{part.ruby}</rt>
            </ruby>
          );
        }
      })}
    </React.Fragment>
  );
}

FormattedText.propTypes = {
  text: PropTypes.string.isRequired,
};

export default FormattedText;
