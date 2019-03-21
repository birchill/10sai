import * as React from 'react';

export function NoteCorner() {
  return (
    <svg className="corner" viewBox="0 0 100 100">
      <polygon fill="hsl(53.8, 100%, 91.2%)" points="0,0 100,100 0,100" />
      <path
        fill="hsl(50.9, 68.5%, 47.3%)"
        d="M0,0l100,100c0,0-69.5-4.5-78.4-7.09S8.9,85.5,7.2,78.76S0,0,0,0"
      />
      <path
        fill="hsl(53.3, 100%, 98%)"
        d="M0,0l100,100c0,0-62.2-10.3-71-12.8s-12.7-7.4-14.4-14.1S0,0,0,0"
      />
    </svg>
  );
}
