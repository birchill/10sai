import { connect } from 'react-redux';
import Navbar from './Navbar.jsx';

const mapStateToProps = state => ({
  settingsActive: state.nav.popup === 'settings',
  returnLink: `/${state.nav.screen || ''}`,
});

const ActiveNavbar = connect(mapStateToProps)(Navbar);

export default ActiveNavbar;
