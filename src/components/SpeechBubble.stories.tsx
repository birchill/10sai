import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { SpeechBubble } from './SpeechBubble';

interface Props {
  position: 'top' | 'bottom';
  direction: 'center' | 'side';
}

class SimpleSpeechBubbleAndButton extends React.Component<Props> {
  buttonRef: React.RefObject<HTMLInputElement>;

  constructor(props: Props) {
    super(props);
    this.buttonRef = React.createRef<HTMLInputElement>();
  }

  render() {
    return (
      <div>
        <input type="button" ref={this.buttonRef} value="Button" />
        <SpeechBubble
          position={this.props.position}
          direction={this.props.direction}
          referenceElement={this.buttonRef.current}
        >
          {this.props.children}
        </SpeechBubble>
      </div>
    );
  }
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, max-content)',
  gridGap: '1rem',
  justifyContent: 'space-between',
  width: '100%',
  marginTop: '2rem',
};

storiesOf('Components|SpeechBubble', module).add('default', () => (
  <div style={gridStyle}>
    <SimpleSpeechBubbleAndButton position="top" direction="side">
      top / side
    </SimpleSpeechBubbleAndButton>
    <SimpleSpeechBubbleAndButton position="top" direction="center">
      top / center
    </SimpleSpeechBubbleAndButton>
    <SimpleSpeechBubbleAndButton position="top" direction="side">
      top / side
    </SimpleSpeechBubbleAndButton>
    <SimpleSpeechBubbleAndButton position="bottom" direction="side">
      bottom / side
    </SimpleSpeechBubbleAndButton>
    <SimpleSpeechBubbleAndButton position="bottom" direction="center">
      bottom / center
    </SimpleSpeechBubbleAndButton>
    <SimpleSpeechBubbleAndButton position="bottom" direction="side">
      bottom / side
    </SimpleSpeechBubbleAndButton>
  </div>
));
