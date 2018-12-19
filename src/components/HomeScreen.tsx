import * as React from 'react';

import { CardGrid } from './CardGrid';
import { Link } from './Link';
import { LoadingIndicator } from './LoadingIndicator';
import { Navbar } from './Navbar';
import { SyncDisplayState } from '../sync/SyncDisplayState';

interface Props {
  loading: boolean;
  hasCards: boolean;
  syncState: SyncDisplayState;
}

export const HomeScreen: React.SFC<Props> = (props: Props) => {
  let content: React.ReactNode;
  if (props.loading) {
    content = (
      <div className="summary-panel">
        <div className="icon">
          <LoadingIndicator />
        </div>
      </div>
    );
  } else if (props.hasCards) {
    content = <CardGrid />;
  } else {
    content = (
      <div className="summary-panel">
        <div className="icon -general -review" />
        <h4 className="heading">Let&rsquo;s get started!</h4>
        <p className="subheading">
          It looks like you don&rsquo;t have any cards yet.
        </p>
        <div className="details">
          <Link
            className="button -primary -center -icon -add-card"
            href="/cards/new"
          >
            Add a card
          </Link>
          {props.syncState === SyncDisplayState.NotConfigured ? (
            <p>
              <Link
                className="button -center -icon -settings"
                href="/settings#sync"
              >
                Configure sync
              </Link>
            </p>
          ) : (
            ''
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="home-screen">
      <Navbar syncState={props.syncState} />
      <section className="content-screen" tabIndex={-1}>
        {content}
      </section>
    </div>
  );
};
