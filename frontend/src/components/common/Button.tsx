// src/components/common/Button.tsx
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  const baseStyles = `
    relative inline-flex items-center justify-center gap-2
    font-semibold tracking-wide rounded-xl
    transition-all duration-200 ease-out
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-primary
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    active:scale-[0.97] select-none overflow-hidden
  `;

  const variants: Record<ButtonVariant, string> = {
    primary: `
      bg-primary
      hover:bg-primary-hover
      text-white shadow-lg shadow-primary/20
      focus:ring-primary
      border border-primary/20
    `,
    secondary: `
      bg-bg-surface/90 hover:bg-accent/20
      text-text-primary border border-border-default
      hover:border-border-default focus:ring-accent
      shadow-md
    `,
    ghost: `
      bg-transparent hover:bg-bg-surface/90
      text-text-secondary hover:text-text-primary
      border border-transparent hover:border-border-default
      focus:ring-accent
    `,
    danger: `
      bg-gradient-to-br from-red-500 to-rose-600
      hover:from-red-400 hover:to-rose-500
      text-white shadow-lg shadow-red-500/25
      focus:ring-red-500
      border border-red-400/20
    `,
    success: `
      bg-gradient-to-br from-emerald-500 to-teal-600
      hover:from-emerald-400 hover:to-teal-500
      text-white shadow-lg shadow-emerald-500/25
      focus:ring-emerald-500
      border border-emerald-400/20
    `,
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs h-8',
    md: 'px-5 py-2.5 text-sm h-10',
    lg: 'px-7 py-3.5 text-base h-12',
  };

  return (
    <button
      disabled={disabled || loading}
      className={`
        ${baseStyles}
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        ${className}
      `}
      {...props}
    >
      {/* Shimmer effect for primary */}
      {variant === 'primary' && !disabled && !loading && (
        <span className="absolute inset-0 -translate-x-full hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-12 pointer-events-none" />
      )}

      {loading ? (
        <>
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading...</span>
        </>
      ) : (
        <>
          {leftIcon && <span className="shrink-0">{leftIcon}</span>}
          <span>{children}</span>
          {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </>
      )}
    </button>
  );
};

export default Button;