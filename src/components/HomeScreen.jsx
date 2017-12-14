import React from 'react';
import { connect } from 'react-redux';

import CardGrid from './CardGrid.jsx';
import Navbar from './Navbar.jsx';

const ConnectedNavbar =
  connect(state => ({ syncState: state.sync.state }))(Navbar);

function HomeScreen() {
  return (
    <div className="home-screen">
      <ConnectedNavbar />
      <section className="content-screen" tabIndex="-1">
        <CardGrid />
      </section>
    </div>
  );
}

export default HomeScreen;
