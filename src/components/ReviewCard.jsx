import React from 'react';
import PropTypes from 'prop-types';

import TextRegion from './TextRegion.jsx';
import ReviewCardBack from './ReviewCardBack.jsx';

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
      }}>
      <div className="front">
        <TextRegion className="question" text={props.question} />
      </div>
      <ReviewCardBack
        className="back"
        question={props.question}
        answer={props.answer}
      />
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
