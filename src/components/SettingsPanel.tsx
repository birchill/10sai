import React from 'react';

interface Props {
  heading: string;
  children?: React.ReactElement<any>;
}

export const SettingsPanel: React.SFC<Props> = (props: Props) => {
  return (
    <div className="settings-panel">
      <h3 className="heading">{props.heading}</h3>
      {props.children}
    </div>
  );
};

export default SettingsPanel;
