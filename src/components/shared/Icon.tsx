import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ name, className = '', style }: IconProps): React.ReactElement {
  return (
    <span className={`material-icons ${className}`} style={style} aria-hidden="true">
      {name}
    </span>
  );
}
