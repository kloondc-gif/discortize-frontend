'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ENDPOINTS, apiRequest } from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    // Call the verification endpoint
    const verifyEmail = async () => {
      try {
        await apiRequest(`${API_ENDPOINTS.verifyEmail}?token=${token}`, 'GET');
        setStatus('success');
        setMessage('Your email has been verified successfully!');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } catch (err: any) {
        setStatus('error');
        setMessage(err.message || 'Verification failed. The link may have expired.');
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-form">
          <div style={{ textAlign: 'center' }}>
            <h1 className="login-title" style={{ marginBottom: '2rem' }}>
              {status === 'loading' && 'Verifying Email...'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Failed'}
            </h1>

            {status === 'loading' && (
              <div>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #000',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }} />
                <p>Please wait while we verify your email...</p>
              </div>
            )}

            {status === 'success' && (
              <div>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>✓</div>
                <p style={{ fontSize: '18px', marginBottom: '10px' }}>{message}</p>
                <p style={{ color: '#666' }}>Redirecting to login page...</p>
              </div>
            )}

            {status === 'error' && (
              <div>
                <div style={{ fontSize: '64px', marginBottom: '20px', color: '#ff0000' }}>✗</div>
                <p style={{ fontSize: '18px', marginBottom: '20px', color: '#ff0000' }}>{message}</p>
                <Link href="/login" style={{ 
                  display: 'inline-block',
                  padding: '12px 30px',
                  backgroundColor: '#000',
                  color: '#fff',
                  textDecoration: 'none',
                  borderRadius: '4px',
                  marginTop: '20px'
                }}>
                  Go to Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
