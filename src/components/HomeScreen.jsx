import React from 'react';
import PropTypes from 'prop-types';

import CardGrid from './CardGrid.jsx';
import Link from './Link.jsx';
import LoadingIndicator from './LoadingIndicator.jsx';
import Navbar from './Navbar.jsx';
import SyncState from '../sync/states';

function HomeScreen(props) {
  let content;
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
          {props.syncState === SyncState.NOT_CONFIGURED ? (
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
      <section className="content-screen" tabIndex="-1">
        {content}
      </section>
    </div>
  );
}

HomeScreen.propTypes = {
  loading: PropTypes.bool.isRequired,
  hasCards: PropTypes.bool.isRequired,
  syncState: PropTypes.symbol.isRequired,
};

export default HomeScreen;
