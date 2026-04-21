// src/components/common/Avatar.tsx
import React, { useState } from 'react';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
type StatusType = 'online' | 'offline' | 'busy' | 'away';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  status?: StatusType;
  showStatus?: boolean;
  className?: string;
  onClick?: () => void;
  
  ring?: boolean;
}

const sizeConfig: Record<AvatarSize, { container: string; text: string; status: string; statusPos: string }> = {
  xs:  { container: 'w-6 h-6',   text: 'text-xs',    status: 'w-1.5 h-1.5', statusPos: 'bottom-0 right-0' },
  sm:  { container: 'w-8 h-8',   text: 'text-xs',    status: 'w-2 h-2',     statusPos: 'bottom-0 right-0' },
  md:  { container: 'w-10 h-10', text: 'text-sm',    status: 'w-2.5 h-2.5', statusPos: 'bottom-0 right-0' },
  lg:  { container: 'w-12 h-12', text: 'text-base',  status: 'w-3 h-3',     statusPos: 'bottom-0.5 right-0.5' },
  xl:  { container: 'w-16 h-16', text: 'text-xl',    status: 'w-3.5 h-3.5', statusPos: 'bottom-0.5 right-0.5' },
  '2xl': { container: 'w-20 h-20', text: 'text-2xl', status: 'w-4 h-4',     statusPos: 'bottom-1 right-1' },
};

const statusColors: Record<StatusType, string> = {
  online:  'bg-emerald-400 shadow-emerald-400/50',
  offline: 'bg-text-disabled',
  busy:    'bg-red-400 shadow-red-400/50',
  away:    'bg-amber-400 shadow-amber-400/50',
};

// Generate consistent color from name
const getAvatarColor = (name: string): string => {
  const colors = [
    'from-primary to-accent',
    'from-blue-500 to-cyan-600',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-600',
    'from-pink-500 to-rose-600',
    'from-accent to-primary',
    'from-teal-500 to-green-600',
    'from-fuchsia-500 to-pink-600',
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

const getInitials = (name: string): string => {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();
};

const Avatar: React.FC<AvatarProps> = ({
  src,
  name = 'User',
  size = 'md',
  status,
  showStatus = false,
  className = '',
  onClick,
  ring = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const config = sizeConfig[size];
  const showFallback = !src || imgError;
  const gradientClass = getAvatarColor(name);

  return (
    <div
      className={`
        relative inline-flex shrink-0
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {/* Avatar */}
      <div
        className={`
          ${config.container}
          rounded-full overflow-hidden
          flex items-center justify-center
          transition-all duration-200
          ${ring ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-bg-primary' : ''}
          ${onClick ? 'hover:ring-2 hover:ring-primary/40 hover:ring-offset-1 hover:ring-offset-bg-primary' : ''}
          ${showFallback ? `bg-gradient-to-br ${gradientClass}` : 'bg-bg-surface'}
        `}
      >
        {!showFallback ? (
          <img
            src={src!}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <span className={`
            ${config.text} font-bold text-white
            select-none tracking-wide
          `}>
            {getInitials(name)}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {showStatus && status && (
        <span
          className={`
            absolute ${config.statusPos}
            ${config.status}
            rounded-full border-2 border-bg-primary
            ${statusColors[status]}
            ${status !== 'offline' ? 'shadow-sm' : ''}
          `}
        >
          {/* Pulse animation for online */}
          {status === 'online' && (
            <span className={`
              absolute inset-0 rounded-full
              ${statusColors[status]}
              animate-ping opacity-75
            `} />
          )}
        </span>
      )}
    </div>
  );
};

// Avatar Group - show multiple avatars stacked
interface AvatarGroupProps {
  users: Array<{ name: string; src?: string }>;
  max?: number;
  size?: AvatarSize;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  users,
  max = 4,
  size = 'sm',
}) => {
  const visible = users.slice(0, max);
  const remaining = users.length - max;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user, i) => (
        <div key={i} className="ring-2 ring-bg-primary rounded-full">
          <Avatar src={user.src} name={user.name} size={size} />
        </div>
      ))}
      {remaining > 0 && (
        <div className={`
          ${sizeConfig[size].container}
          rounded-full bg-bg-secondary border-2 border-bg-primary
          flex items-center justify-center
          ${sizeConfig[size].text} font-semibold text-text-secondary
        `}>
          +{remaining}
        </div>
      )}
    </div>
  );
};

export default Avatar;
