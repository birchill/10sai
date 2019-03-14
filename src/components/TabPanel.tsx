import * as React from 'react';

interface Props extends React.HTMLProps<HTMLDivElement> {
  className?: string;
  children?: React.ReactElement<any>;
}

export const TabPanel: React.FC<Props> = (props: Props) => {
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
