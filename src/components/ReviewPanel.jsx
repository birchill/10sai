import PropTypes from 'prop-types';

function ReviewPanel(props) {
  return props.showAnswer ? 'Answer' : 'Question';
}

ReviewPanel.propTypes = {
  showAnswer: PropTypes.bool.isRequired,
};

export default ReviewPanel;
