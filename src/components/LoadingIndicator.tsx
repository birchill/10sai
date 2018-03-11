import React from 'react';

function LoadingIndicator() {
  return (
    <svg className="loading-indicator" viewBox="0 0 100 30">
      <circle className="dot" cx="20" cy="15" r="15" />
      <circle className="dot" cx="50" cy="15" r="15" />
      <circle className="dot" cx="80" cy="15" r="15" />
    </svg>
  );
}

export default LoadingIndicator;
