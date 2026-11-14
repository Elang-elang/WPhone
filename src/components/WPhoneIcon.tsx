import React, { useState } from 'react';
import { USER_ICONS } from '../i18n/translations';

interface IconProps {
  variant: 'launcher' | 'internal';
  className?: string;
  alt?: string;
}

export const WPhoneIcon: React.FC<IconProps> = ({
  variant,
  className = 'w-7 h-7',
  alt = 'WPhone',
}) => {
  const [failed, setFailed] = useState(false);
  const src = variant === 'launcher' ? USER_ICONS.appLauncher : USER_ICONS.internalWindows;

  if (failed) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-[#0078D4] text-white shrink-0 ${className}`}
        aria-label={alt}
      >
        <svg viewBox="0 0 24 24" className="w-4/6 h-4/6 fill-current" aria-hidden="true">
          <path d="M3 5.5L10.5 4.4V11.3H3V5.5ZM11.7 4.2L21 2.8V11.3H11.7V4.2ZM3 12.5H10.5V19.6L3 18.5V12.5ZM11.7 12.5H21V21.2L11.7 19.8V12.5Z" />
        </svg>
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-contain shrink-0 ${variant === 'launcher' ? 'rounded-md' : ''} ${className}`}
    />
  );
};
