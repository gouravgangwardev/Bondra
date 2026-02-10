// src/components/common/LoadingSpinner.tsx
import React from 'react';

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type SpinnerVariant = 'ring' | 'dots' | 'pulse' | 'bars';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  color?: string;
  label?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

// Ring spinner
const RingSpinner: React.FC<{ size: SpinnerSize; color: string }> = ({ size, color }) => (
  <div className={`relative ${sizeClasses[size]}`}>
    <div className={`
      absolute inset-0 rounded-full
      border-2 border-gray-700/40
    `} />
    <div className={`
      absolute inset-0 rounded-full
      border-2 border-transparent animate-spin
      ${color}
    `}
    style={{ borderTopColor: 'currentColor' }}
    />
  </div>
);

// Dots spinner
const DotsSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => {
  const dotSize = {
    xs: 'w-1 h-1',
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3',
  }[size];

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`${dotSize} rounded-full bg-violet-400 animate-bounce`}
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.6s' }}
        />
      ))}
    </div>
  );
};

// Pulse spinner
const PulseSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => (
  <div className={`relative ${sizeClasses[size]}`}>
    <div className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping" />
    <div className="relative rounded-full bg-violet-500 w-full h-full scale-50" />
  </div>
);

// Bars spinner
const BarsSpinner: React.FC<{ size: SpinnerSize }> = ({ size }) => {
  const barHeight = {
    xs: 'h-2',
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5',
    xl: 'h-7',
  }[size];

  const barWidth = {
    xs: 'w-0.5',
    sm: 'w-0.5',
    md: 'w-1',
    lg: 'w-1',
    xl: 'w-1.5',
  }[size];

  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`${barWidth} ${barHeight} rounded-full bg-violet-400`}
          style={{
            animation: 'barPulse 1s ease-in-out infinite',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes barPulse {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'ring',
  color = 'text-violet-400',
  label,
  fullScreen = false,
  overlay = false,
}) => {
  const spinnerMap = {
    ring: <RingSpinner size={size} color={color} />,
    dots: <DotsSpinner size={size} />,
    pulse: <PulseSpinner size={size} />,
    bars:  <BarsSpinner size={size} />,
  };

  const spinner = (
    <div className={`flex flex-col items-center gap-3 ${color}`}>
      {spinnerMap[variant]}
      {label && (
        <span className="text-xs text-gray-400 font-medium animate-pulse">
          {label}
        </span>
      )}
    </div>
  );

  // Full screen loading
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950">
        <div className="flex flex-col items-center gap-6">
          {/* Logo area */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          {spinner}
        </div>
      </div>
    );
  }

  // Overlay loading (over content)
  if (overlay) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-950/70 backdrop-blur-sm rounded-xl">
        {spinner}
      </div>
    );
  }

  return spinner;
};

// Page loading skeleton
export const PageSkeleton: React.FC = () => (
  <div className="flex flex-col gap-4 p-4 animate-pulse">
    <div className="h-8 bg-gray-800/60 rounded-xl w-1/3" />
    <div className="h-4 bg-gray-800/60 rounded-lg w-full" />
    <div className="h-4 bg-gray-800/60 rounded-lg w-5/6" />
    <div className="h-4 bg-gray-800/60 rounded-lg w-4/6" />
    <div className="grid grid-cols-3 gap-3 mt-2">
      {[1,2,3].map(i => (
        <div key={i} className="h-24 bg-gray-800/60 rounded-xl" />
      ))}
    </div>
  </div>
);

// Card skeleton
export const CardSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3 animate-pulse">
    <div className="w-10 h-10 bg-gray-800/60 rounded-full shrink-0" />
    <div className="flex flex-col gap-2 flex-1">
      <div className="h-3.5 bg-gray-800/60 rounded-lg w-1/3" />
      <div className="h-3 bg-gray-800/60 rounded-lg w-2/3" />
    </div>
  </div>
);

export default LoadingSpinner;
