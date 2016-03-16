'use strict';

import React from 'react';

export class CardRow extends React.Component {
  render() {
    return (
      <tr>
        <td className="question">{this.props.question}</td>
        <td className="answer">{this.props.answer}</td>
        <td className="delete">X</td>
      </tr>
    );
  }
}

export default CardRow;
