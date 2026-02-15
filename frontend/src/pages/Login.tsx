// src/pages/Login.tsx
import React, { useState } from 'react';
import { Input, Button } from '../components/common';

interface LoginProps {
  onLogin?: (credentials: { email: string; password: string }) => void;
  onNavigate?: (route: string) => void;
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, onNavigate, isLoading = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onLogin?.({ email, password });
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-sm text-gray-500">Sign in to continue chatting</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
          />
          
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 text-gray-400 cursor-pointer">
              <input type="checkbox" className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-violet-500" />
              Remember me
            </label>
            <button type="button" className="text-violet-400 hover:text-violet-300 transition-colors">
              Forgot password?
            </button>
          </div>

          <Button variant="primary" size="lg" fullWidth loading={isLoading} type="submit">
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-800" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-gray-950 text-gray-500">OR</span>
          </div>
        </div>

        {/* Guest mode */}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => onNavigate?.('/chat')}
        >
          Continue as Guest
        </Button>

        {/* Sign up link */}
        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <button
            onClick={() => onNavigate?.('/register')}
            className="text-violet-400 hover:text-violet-300 font-semibold transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;