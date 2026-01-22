'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      console.log('User already logged in, redirecting to dashboard');
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiRequest(API_ENDPOINTS.login, 'POST', {
        email,
        password,
      });

      console.log('Login response:', { 
        hasAccessToken: !!response.access_token, 
        hasRefreshToken: !!response.refresh_token,
        hasUser: !!response.user 
      });

      // Store user data, access token, and refresh token
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('refresh_token', response.refresh_token);
      localStorage.setItem('user', JSON.stringify(response.user));

      console.log('Tokens stored, redirecting to dashboard...');

      // Small delay to ensure localStorage is written
      await new Promise(resolve => setTimeout(resolve, 100));

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-form">
          <div className="login-header">
            <Link href="/" className="back-button">
              <img src="/leftArrow.svg" alt="Back" className="back-arrow" />
            </Link>
            <h1 className="login-title">Log in</h1>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="email-container">
              <input
                type="email"
                placeholder="Email address"
                autoComplete="email"
                className="email-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="email-container">
              <input
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                className="email-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}
            
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Logging in...' : 'Enter'}
            </button>
          </form>
          
          <p className="terms-text">
            By signing in, you agree to Discortize's{' '}
            <a href="#" className="terms-link">terms and conditions</a>{' '}
            and the{' '}
            <a href="#" className="terms-link">privacy policy</a>.
          </p>
          
          <p className="signup-link">
            Don't have an account?{' '}
            <Link href="/signup" className="signup-link-text">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
