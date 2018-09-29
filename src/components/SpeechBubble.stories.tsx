import React from 'react';
import { storiesOf } from '@storybook/react';
import { action } from '@storybook/addon-actions';

import { AnchoredSpeechBubble } from './AnchoredSpeechBubble';

interface SpeechBubbleAndButtonProps {
  position: 'above' | 'below';
  align: 'center' | 'largest-side' | 'inline-direction';
}

class SpeechBubbleAndButton extends React.Component<
  SpeechBubbleAndButtonProps
> {
  buttonRef: React.RefObject<HTMLInputElement>;

  constructor(props: SpeechBubbleAndButtonProps) {
    super(props);
    this.buttonRef = React.createRef<HTMLInputElement>();
  }

  componentDidMount() {
    // The button reference will now be resolved so we need to force an update.
    this.forceUpdate();
  }

  render() {
    return (
      <div>
        <input type="button" ref={this.buttonRef} value="Button" />
        <AnchoredSpeechBubble
          position={this.props.position}
          align={this.props.align}
          anchorElement={this.buttonRef.current}
        >
          {this.props.children}
        </AnchoredSpeechBubble>
      </div>
    );
  }
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, max-content)',
  gridGap: '1rem',
  justifyContent: 'space-between',
  width: '100%',
};

storiesOf('Components|SpeechBubble', module)
  .add('largest-side', () => (
    <div>
      <p>LTR:</p>
      <div style={rowStyle}>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
      </div>
      <p style={{ marginTop: '3rem' }}>RTL:</p>
      <div style={{ ...rowStyle, direction: 'rtl' }}>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="largest-side">
          below / largest-side
        </SpeechBubbleAndButton>
      </div>
    </div>
  ))
  .add('inline-direction', () => (
    <div>
      <p>LTR:</p>
      <div style={rowStyle}>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
      </div>
      <p style={{ marginTop: '3rem' }}>RTL:</p>
      <div style={{ ...rowStyle, direction: 'rtl' }}>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="inline-direction">
          below / inline-direction
        </SpeechBubbleAndButton>
      </div>
    </div>
  ))
  .add('center', () => (
    <div>
      <p>LTR:</p>
      <div style={rowStyle}>
        <SpeechBubbleAndButton position="below" align="center">
          below / center
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="center">
          below / center
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="center">
          below / center<br />
          Supercalifragilisticexpialidocious<br />
          (This one should end of hanging left.)
        </SpeechBubbleAndButton>
      </div>
      <p style={{ marginTop: '3rem' }}>RTL:</p>
      <div style={{ ...rowStyle, direction: 'rtl' }}>
        <SpeechBubbleAndButton position="below" align="center">
          below / center
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="center">
          below / center
        </SpeechBubbleAndButton>
        <SpeechBubbleAndButton position="below" align="center">
          below / center<br />
          Supercalifragilisticexpialidocious<br />
          (This one should end of hanging right.)
        </SpeechBubbleAndButton>
      </div>
    </div>
  ))
  .add('above', () => (
    <div style={{ ...rowStyle, marginTop: '2rem' }}>
      <SpeechBubbleAndButton position="above" align="largest-side">
        above / largest-side
      </SpeechBubbleAndButton>
      <SpeechBubbleAndButton position="above" align="largest-side">
        above / largest-center
      </SpeechBubbleAndButton>
      <SpeechBubbleAndButton position="above" align="largest-side">
        above / largest-side<br />
        This speech bubble has<br />
        quite a number of lines<br />
        and should probably be<br />
        shown below instead.
      </SpeechBubbleAndButton>
    </div>
  ));

interface ShowOnHoverState {
  hovered: boolean;
}

class ShowOnHover extends React.Component<{}, ShowOnHoverState> {
  state: ShowOnHoverState;
  buttonRef: React.RefObject<HTMLInputElement>;

  constructor(props: {}) {
    super(props);
    this.state = {
      hovered: false,
    };
    this.buttonRef = React.createRef<HTMLInputElement>();
    this.handleMouseOver = this.handleMouseOver.bind(this);
    this.handleMouseOut = this.handleMouseOut.bind(this);
  }

  componentDidMount() {
    this.forceUpdate();
  }

  handleMouseOver() {
    this.setState({ hovered: true });
  }

  handleMouseOut() {
    this.setState({ hovered: false });
  }

  render() {
    return (
      <div>
        <input
          type="button"
          ref={this.buttonRef}
          value="Hover me"
          onMouseOver={this.handleMouseOver}
          onMouseOut={this.handleMouseOut}
        />
        <AnchoredSpeechBubble
          position="below"
          align="inline-direction"
          anchorElement={this.buttonRef.current}
          visible={this.state.hovered}
        >
          <p style={{ margin: '.5em' }}>Hello there!</p>
        </AnchoredSpeechBubble>
      </div>
    );
  }
}

storiesOf('Components|SpeechBubble', module).add('show on hover', () => (
  <ShowOnHover />
));

interface ShowOnClickState {
  visible: boolean;
}

class ShowOnClick extends React.Component<{}, ShowOnClickState> {
  state: ShowOnClickState;
  buttonRef: React.RefObject<HTMLInputElement>;

  constructor(props: {}) {
    super(props);
    this.state = {
      visible: false,
    };
    this.buttonRef = React.createRef<HTMLInputElement>();
    this.toggleVisibility = this.toggleVisibility.bind(this);
  }

  componentDidMount() {
    this.forceUpdate();
  }

  toggleVisibility() {
    this.setState({ visible: !this.state.visible });
  }

  render() {
    return (
      <div>
        <input
          type="button"
          ref={this.buttonRef}
          value="Click me"
          onClick={this.toggleVisibility}
        />
        <AnchoredSpeechBubble
          position="below"
          align="inline-direction"
          anchorElement={this.buttonRef.current}
          visible={this.state.visible}
        >
          <p style={{ margin: '.5em' }}>Hello there!</p>
        </AnchoredSpeechBubble>
      </div>
    );
  }
}

storiesOf('Components|SpeechBubble', module).add('show on click', () => (
  <ShowOnClick />
));
