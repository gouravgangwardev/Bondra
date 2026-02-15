// src/pages/NotFound.tsx
import React from 'react';

interface NotFoundProps {
  onNavigate?: (route: string) => void;
}

const NotFound: React.FC<NotFoundProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        
        {/* 404 illustration */}
        <div className="relative mb-8">
          <div className="text-9xl font-black text-transparent bg-gradient-to-br from-violet-500 to-cyan-500 bg-clip-text">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-32 h-32 rounded-full bg-violet-500/10 blur-3xl" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-white mb-3">Page Not Found</h1>
        <p className="text-gray-400 mb-8 leading-relaxed">
          Oops! The page you're looking for doesn't exist. It might have been moved or deleted.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => onNavigate?.('/')}
            className="px-6 py-3 rounded-xl font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white transition-all shadow-lg shadow-violet-500/25"
          >
            Go Home
          </button>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 rounded-xl font-semibold bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-gray-700/60 transition-all"
          >
            Go Back
          </button>
        </div>

        {/* Help text */}
        <p className="text-sm text-gray-600 mt-8">
          Need help? Check out our{' '}
          <button className="text-violet-400 hover:text-violet-300 transition-colors">
            help center
          </button>
        </p>
      </div>
    </div>
  );
};

export default NotFound;
