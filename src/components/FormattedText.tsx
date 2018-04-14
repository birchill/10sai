import React from 'react';
import PropTypes from 'prop-types';

import { parseRuby } from '../text/ruby';

interface Props {
  text: string;
}

const FormattedText: React.SFC<Props> = props => {
  const parts = parseRuby(props.text);

  return (
    <>
      {parts.map(part => {
        if (typeof part === 'string') {
          return part;
        } else {
          return (
            <ruby>
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
