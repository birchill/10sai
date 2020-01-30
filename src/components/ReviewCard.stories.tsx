import * as React from 'react';
import { storiesOf } from '@storybook/react';

import { ReviewCard } from './ReviewCard';

const large = {
  width: '600px',
  height: '600px',
};
const small = {
  width: '300px',
  height: '200px',
};

storiesOf('Components|ReviewCard', module)
  .add('large (front)', () => (
    <div style={large}>
      <ReviewCard front="短い" back="みじかい" />
    </div>
  ))
  .add('large (back)', () => (
    <div style={large}>
      <ReviewCard front="短い" back="みじかい" showBack />
    </div>
  ))
  .add('small/landscape (front)', () => (
    <div style={small}>
      <ReviewCard front="短い" back="みじかい" />
    </div>
  ))
  .add('small/landscape (back)', () => (
    <div style={small}>
      <ReviewCard front="短い" back="みじかい" showBack />
    </div>
  ))
  .add('ruby (front)', () => (
    <div style={large}>
      <ReviewCard front="{短|みじか}い" back="みじかい" />
    </div>
  ))
  .add('ruby (back)', () => (
    <div style={large}>
      <ReviewCard
        front="{短|みじか}い"
        back="{ミジカイ|み|じ|か|い}"
        showBack
      />
    </div>
  ))
  .add('long message (front)', () => (
    <div style={large}>
      <ReviewCard
        front="This is the question that never ends. It just goes on and on my friend. Somebody started writing it not know what it was..."
        back="This answer is also long, but not quite as long"
      />
    </div>
  ))
  .add('long message (back)', () => (
    <div style={large}>
      <ReviewCard
        front="This is the question that never ends. It just goes on and on my friend. Somebody started writing it not know what it was..."
        back="This answer is also long, but not quite as long"
        showBack
      />
    </div>
  ))
  .add('rich text (front)', () => (
    <div style={large}>
      <ReviewCard
        front="􅨐b􅨑Bold􅨜, 􅨐i􅨑italic􅨜, 􅨐u􅨑underline􅨜, 􅨐.􅨑emphasis􅨜"
        back="􅨐b􅨝i􅨝u􅨝e􅨑Everything at once!􅨜"
      />
    </div>
  ))
  .add('rich text (back)', () => (
    <div style={large}>
      <ReviewCard
        front="􅨐b􅨑Bold􅨜, 􅨐i􅨑italic􅨜, 􅨐u􅨑underline􅨜, 􅨐.􅨑emphasis􅨜"
        back="􅨐b􅨝i􅨝u􅨝.􅨑Everything at once!􅨜"
        showBack
      />
    </div>
  ))
  .add('updating (front)', () => <UpdatingReviewCard />)
  .add('malformed rich text (front)', () => (
    <div style={large}>
      <ReviewCard front="􅨐b􅨑Bold" back="" />
    </div>
  ));

class State {
  index: number;
}

class UpdatingReviewCard extends React.PureComponent<{}, State> {
  state: State = {
    index: 0,
  };

  strings: Array<string> = [
    '短い',
    '少しだけ長めのやつ',
    'めっっっっっちゃ長～～～～～い。マジで長い。なかなか終わらん。',
  ];

  constructor(props: {}) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    const index =
      this.state.index + 1 >= this.strings.length ? 0 : this.state.index + 1;
    this.setState({ index });
  }

  render() {
    return (
      <div className="series">
        <div style={large}>
          <ReviewCard front={this.strings[this.state.index]} back="" />
        </div>
        <button className="button" onClick={this.handleClick}>
          Update
        </button>
      </div>
    );
  }
}
