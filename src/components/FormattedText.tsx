import React from 'react';
import PropTypes from 'prop-types';

import { parseRuby } from '../text/ruby';

interface Props {
  text: string;
}

const FormattedText: React.SFC<Props> = props => {
  const parts = parseRuby(props.text);

  // Track how many times each substring occurs so we can assign unique keys
  const keys: {
    [key: string]: number;
  } = {};

  return (
    <>
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
    </>
  );
};

FormattedText.propTypes = {
  text: PropTypes.string.isRequired,
};

export default FormattedText;
