// src/pages/NotFound.tsx
import React from 'react';

interface NotFoundProps {
  onNavigate?: (route: string) => void;
}

const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        
        {/* 404 illustration */}
        <div className="relative mb-8">
          <div className="text-9xl font-black text-transparent bg-gradient-to-br from-primary to-accent bg-clip-text">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-primary/10 blur-3xl" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-text-primary mb-3">Page Not Found</h1>
        <p className="text-text-secondary mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => onNavigate?.('/')}
            className="px-6 py-3 rounded-xl font-semibold bg-primary hover:bg-primary-hover text-text-primary transition-all shadow-lg shadow-primary/15"
          >
            Go Home
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 rounded-xl font-semibold bg-bg-surface/90 hover:bg-accent/20 text-text-primary border border-border-default transition-all"
          >
            Go Back
          </button>
        </div>

        {/* Help text */}
        <p className="text-sm text-text-disabled mt-8">
          Need help? Check out our{' '}
          <button className="text-primary hover:text-primary-hover transition-colors">
            help center
          </button>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
