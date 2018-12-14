import React from 'react';

interface Props {
  className?: string;
  children?: React.ReactElement<any>;
}

export const TabPanel: React.SFC<Props> = (props: Props) => {
  const className =
    typeof props.className === 'undefined'
      ? 'tab-panel'
      : `tab-panel ${props.className}`;
  return (
    <div {...props} className={className}>
      {props.children}
    </div>
  );
};

export default TabPanel;
