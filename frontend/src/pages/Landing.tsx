// src/pages/Landing.tsx
import React from 'react';
import { NavigateFunction } from 'react-router-dom';

interface LandingProps {
  onNavigate?: NavigateFunction | ((route: string) => void);
}

const Landing: React.FC<LandingProps> = ({ onNavigate }) => {
  const go = (route: string) => onNavigate?.(route);

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/8" />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(139, 92, 246, 0.15) 1px, transparent 0)',
          backgroundSize: '48px 48px'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold text-primary-hover">Join 1,247+ users online now</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold text-text-primary mb-6 leading-tight">
              Meet Strangers.<br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Make Friends.</span>
            </h1>

            <p className="text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
              Connect with people from around the world through random video, audio, or text chat.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => go('/login')}
                className="px-8 py-4 rounded-2xl font-bold text-lg bg-primary hover:bg-primary-hover text-text-primary shadow-2xl shadow-primary/20 transition-all"
              >
                Start Chatting Now
              </button>
              <button
                onClick={() => go('/register')}
                className="px-8 py-4 rounded-2xl font-semibold text-lg bg-bg-surface/90 hover:bg-accent/20 text-text-primary border border-border-default transition-all"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Features row */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '🎥', title: 'Video Chat', desc: 'Face-to-face with anyone, anywhere.' },
            { icon: '🎙️', title: 'Voice Chat',  desc: 'Talk without showing your face.' },
            { icon: '💬', title: 'Text Chat',   desc: 'Classic anonymous messaging.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="p-6 rounded-2xl bg-bg-secondary/80 border border-border-subtle">
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-bold text-text-primary mb-1">{title}</h3>
              <p className="text-sm text-text-secondary">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Landing;