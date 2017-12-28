import { connect } from 'react-redux';

import HomeScreen from './HomeScreen.jsx';

// XXX Need to declare the cardStore contextType here and use it to lookup if we
// have any cards (and initially set loading to true while waiting on that).
//
// See example here: https://css-tricks.com/learning-react-redux/#article-header-id-13

export default connect(state => ({
  syncState: state.sync.state,
  loading: false,
  hasCards: false,
}))(HomeScreen);
