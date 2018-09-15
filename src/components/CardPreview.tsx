import React from 'react';
import PropTypes from 'prop-types';

import { deserialize, Inline } from '../text/rich-text';
import { styleClassMapping } from '../text/rich-text-styles';
import { stripRuby } from '../text/ruby';

interface Props {
  question: string;
}

export const CardPreview: React.SFC<Props> = props => {
  // If this proves slow we can try to either:
  //
  // - Memoize the result of deserialize (if that is the bottleneck)
  // - Possibly even do bulk parsing and rendering in a WASM module, have it
  //   spit out HTML strings and use dangerouslySetInnerHTML on them.
  //
  // For now, though, it seems acceptable.
  const blocks = deserialize(props.question);
  let i = 0;

  // I thought flexbox was supposed to fix all the problems with CSS but
  // we still have to add an extra div just to use it :/
  return (
    <div className="card-preview">
      <div className="flex-container">
        <span className="question">
          {blocks.map(block => {
            const key = `block-${i++}`;
            return <p key={key}>{renderChildren(block.children, key)}</p>;
          })}
        </span>
      </div>
    </div>
  );
};

CardPreview.propTypes = {
  question: PropTypes.string.isRequired,
};

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
          return stripRuby(child);
        } else {
          const className = child.styles
            .map(style => styleClassMapping.get(style))
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

export default CardPreview;
