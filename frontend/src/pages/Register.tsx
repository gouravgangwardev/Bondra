// src/pages/Register.tsx
import React, { useState } from 'react';
import { Input, Button } from '../components/common';
import { useAuthContext } from '../context/AuthContext';

interface RegisterProps {
  onRegister?: (data: { username: string; email: string; password: string }) => void;
  onNavigate?: (route: string) => void;
  isLoading?: boolean;
}

const Register: React.FC<RegisterProps> = ({ onRegister, onNavigate, isLoading = false }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { error, clearError } = useAuthContext();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }
    if (!agreedToTerms) {
      setLocalError('Please agree to the Terms of Service to continue');
      return;
    }
    onRegister?.({ username, email, password });
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary flex items-center justify-center shadow-xl shadow-primary/20">
            <svg className="w-8 h-8 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Create Account</h1>
          <p className="text-sm text-text-secondary">Join RandomChat and start meeting new people</p>
        </div>

        {/* Error banner */}
        {displayError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
          <Input
            label="Username"
            value={username}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            placeholder="Choose a username"
            required
          />

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
            placeholder="Create a password"
            hint="At least 8 characters"
            required
          />

          <Input
            label="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            error={confirmPassword && password !== confirmPassword ? 'Passwords do not match' : undefined}
            required
          />

          <label className="flex items-start gap-3 text-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 rounded border-border-default bg-bg-surface text-primary mt-0.5"
            />
            <span>
              I agree to the{' '}
              <button type="button" className="text-primary hover:text-primary-hover">Terms of Service</button>
              {' '}and{' '}
              <button type="button" className="text-primary hover:text-primary-hover">Privacy Policy</button>
            </span>
          </label>

          <Button variant="primary" size="lg" fullWidth loading={isLoading} type="submit">
            Create Account
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{' '}
          <button
            onClick={() => onNavigate?.('/login')}
            className="text-primary hover:text-primary-hover font-semibold transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default Register;