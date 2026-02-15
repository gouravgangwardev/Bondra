// src/pages/Landing.tsx
import React from 'react';

interface LandingProps {
  onNavigate?: (route: string) => void;
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-950">
      
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-cyan-500/10" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.15) 1px, transparent 0)',
          backgroundSize: '48px 48px'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-violet-300">Join 1,247+ users online now</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-white mb-6 leading-tight">
              Meet Strangers.<br />
              <span className="bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Make Friends.</span>
            </h1>
            
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Connect with people from around the world through random video, audio, or text chat.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onNavigate?.('/chat')}
                className="px-8 py-4 rounded-2xl font-bold text-lg bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white shadow-2xl shadow-violet-500/30 transition-all"
              >
                Start Chatting Now
              </button>
              <button
                onClick={() => onNavigate?.('/register')}
                className="px-8 py-4 rounded-2xl font-semibold text-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-200 border border-gray-700/60 transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;