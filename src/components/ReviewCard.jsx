import React from 'react';
import PropTypes from 'prop-types';

import FormattedText from './FormattedText.tsx';
import TextRegion from './TextRegion.jsx';

function ReviewCard(props) {
  let className = 'review-card';
  if (props.showAnswer) {
    className += ' -showanswer';
  }
  if (props.className) {
    className += ` ${props.className}`;
  }

  return (
    <div
      className={className}
      onClick={props.onSelectCard}
      onKeyPress={evt => {
        if (evt.key === 'Enter' || evt.key === 'Space') {
          props.onSelectCard();
        }
      }}
    >
      <div className="front">
        <TextRegion className="question">
          <FormattedText text={props.question} />
        </TextRegion>
      </div>
      <div className="back">
        <TextRegion className="question">
          <FormattedText text={props.question} />
        </TextRegion>
        <hr className="card-divider divider" />
        <TextRegion className="answer">
          <FormattedText text={props.answer} />
        </TextRegion>
      </div>
    </div>
  );
}

ReviewCard.propTypes = {
  question: PropTypes.string.isRequired,
  answer: PropTypes.string,
  showAnswer: PropTypes.bool,
  className: PropTypes.string,
  onSelectCard: PropTypes.func,
};

export default ReviewCard;
