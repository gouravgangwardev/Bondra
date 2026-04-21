// src/pages/Login.tsx

import React, { useState } from 'react';
import { Input, Button } from '../components/common';

interface LoginProps {
  onLogin?: (credentials: { email: string; password: string }) => Promise<void>;
  onNavigate?: (route: string) => void;
  isLoading?: boolean;
}

const Login: React.FC<LoginProps> = ({
  onLogin,
  onNavigate,
  isLoading = false,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  console.log("LOGIN PAGE RENDER", { isLoading });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!onLogin) {
      console.error("onLogin NOT PROVIDED");
      return;
    }

    try {
      console.log("LOGIN CLICKED");

      await onLogin({ email, password });

      // FIX Bug 8: Navigation handled by App.tsx handleLogin — no double push needed.
    } catch (err) {
      console.error("LOGIN FAILED:", err);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <svg className="w-8 h-8 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Welcome Back</h1>
          <p className="text-sm text-text-secondary">Sign in to continue chatting</p>
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
            <label className="flex items-center gap-2 text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-border-default bg-bg-surface text-primary"
              />
              Remember me
            </label>

            <button
              type="button"
              className="text-primary hover:text-primary-hover transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isLoading}
            type="submit"
            disabled={isLoading}
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-bg-primary text-text-secondary">OR</span>
          </div>
        </div>

        {/* Guest mode */}
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => {
            console.log("GUEST NAVIGATION");
            onNavigate?.('/chat');
          }}
        >
          Continue as Guest
        </Button>

        {/* Sign up link */}
        <p className="text-center text-sm text-text-secondary mt-6">
          Don't have an account?{' '}
          <button
            onClick={() => {
              console.log("NAVIGATE REGISTER");
              onNavigate?.('/register');
            }}
            className="text-primary hover:text-primary-hover font-semibold transition-colors"
          >
            Sign up
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;

