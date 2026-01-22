'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

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

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await apiRequest(API_ENDPOINTS.register, 'POST', {
        email,
        username,
        password,
      });

      setSuccess(true);
      // Don't auto-redirect, let user read the message
    } catch (err: any) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-form">
            <div style={{ textAlign: 'center' }}>
              <h1 className="login-title" style={{ marginBottom: '2rem' }}>Check your email</h1>
              
              <div style={{ 
                width: '80px', 
                height: '80px', 
                margin: '0 auto 30px',
                border: '3px solid #000',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px'
              }}>
                ✉
              </div>
              
              <p style={{ 
                fontSize: '16px',
                lineHeight: '1.6',
                color: '#333',
                marginBottom: '10px'
              }}>
                We've sent a verification link to
              </p>
              
              <p style={{ 
                fontSize: '16px',
                fontWeight: '600',
                color: '#000',
                marginBottom: '30px'
              }}>
                {email}
              </p>
              
              <div style={{
                padding: '20px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px',
                marginBottom: '30px'
              }}>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#333',
                  margin: '0 0 10px 0',
                  lineHeight: '1.6'
                }}>
                  <strong>Next steps:</strong>
                </p>
                <ol style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  margin: 0,
                  paddingLeft: '20px',
                  lineHeight: '1.8'
                }}>
                  <li>Check your inbox for our verification email</li>
                  <li>Click the verification link in the email</li>
                  <li>You'll be redirected to log in</li>
                </ol>
              </div>
              
              <p style={{ 
                fontSize: '13px', 
                color: '#999',
                marginBottom: '30px'
              }}>
                The link will expire in 24 hours
              </p>
            </div>
            
            <div style={{ textAlign: 'center' }}>
              <button 
                onClick={() => router.push('/login')}
                className="submit-button"
              >
                Go to Login
              </button>
            </div>
            
            <p className="terms-text" style={{ marginTop: '20px', textAlign: 'center' }}>
              Didn't receive the email? Check your spam folder or{' '}
              <a href="#" className="terms-link">resend verification</a>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-form">
          <div className="login-header">
            <Link href="/" className="back-button">
              <img src="/leftArrow.svg" alt="Back" className="back-arrow" />
            </Link>
            <h1 className="login-title">Sign up</h1>
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
                type="text"
                placeholder="Username"
                autoComplete="username"
                className="email-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="email-container">
              <input
                type="password"
                placeholder="Password"
                autoComplete="new-password"
                className="email-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="email-container">
              <input
                type="password"
                placeholder="Confirm password"
                autoComplete="new-password"
                className="email-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>
                {error}
              </div>
            )}
            
            <button type="submit" className="submit-button" disabled={loading}>
              {loading ? 'Creating account...' : 'Enter'}
            </button>
          </form>
          
          <p className="terms-text">
            By signing up, you agree to Discortize's{' '}
            <a href="#" className="terms-link">terms and conditions</a>{' '}
            and the{' '}
            <a href="#" className="terms-link">privacy policy</a>.
          </p>
          
          <p className="signup-link">
            Already have an account?{' '}
            <Link href="/login" className="signup-link-text">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
