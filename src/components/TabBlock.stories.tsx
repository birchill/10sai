import * as React from 'react';
import { storiesOf } from '@storybook/react';
import { withNotes } from '@storybook/addon-notes';

import { TabBlock } from './TabBlock';

interface State {
  selectedTab?: number;
}

class TabBlockExample extends React.PureComponent<{}, State> {
  state: State = {
    selectedTab: undefined,
  };

  selectTab(evt: React.MouseEvent<HTMLAnchorElement>, index: number) {
    this.setState({
      selectedTab: this.state.selectedTab === index ? undefined : index,
    });
    evt.preventDefault();
  }

  render() {
    return (
      <div style={{ width: '800px' }}>
        <TabBlock className="extra-class" active={this.state.selectedTab}>
          <a
            id="lookup-tab"
            href="/lookup"
            aria-controls="lookup-page"
            className="-icon -lookup"
            onClick={evt => {
              this.selectTab(evt, 0);
            }}
          >
            Lookup
          </a>
          <a
            id="add-tab"
            href="/add"
            aria-controls="add-page"
            className="-icon -plus"
            onClick={evt => {
              this.selectTab(evt, 1);
            }}
          >
            Add card
          </a>
          <a
            id="review-tab"
            href="/review"
            aria-controls="review-page"
            className="-icon -review -badge"
            data-badge="10%"
            onClick={evt => {
              this.selectTab(evt, 2);
            }}
          >
            Review
          </a>
        </TabBlock>
      </div>
    );
  }
}

storiesOf('Components|TabBlock', module)
  .addDecorator(withNotes)
  .add('default', () => <TabBlockExample />, {
    notes: `
Each of the tab pages should have, e.g.:

* \`id="lookup-page"\`
* \`role="tabpanel"\`
* \`aria-labelledby="lookup-tab"\`
* \`aria-hidden="true"\` or just hidden boolean attribute
  `,
  });
