'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startTokenRefresh, stopTokenRefresh } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  email_verified: boolean;
  created_at?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userData = localStorage.getItem('user');

    console.log('Dashboard auth check:', { 
      hasToken: !!token, 
      hasRefreshToken: !!refreshToken, 
      hasUser: !!userData 
    });

    if (!token || !userData || !refreshToken) {
      console.log('Missing credentials, redirecting to login');
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setLoading(false);
      
      // Start automatic token refresh only after confirming all credentials exist
      console.log('Starting token refresh...');
      startTokenRefresh();
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    // Cleanup: stop token refresh when component unmounts
    return () => {
      stopTokenRefresh();
    };
  }, [router]);

  const handleLogout = () => {
    // Stop token refresh
    stopTokenRefresh();
    
    // Clear stored data
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
    
    // Redirect to home
    router.push('/');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        color: '#000'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '3px solid #fff',
            borderTop: '3px solid transparent',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#fff',
      color: '#000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="nav">
            <a href="/" className="logo">
              <img src="/discortize-logo.png" alt="Discortize" className="logo-img" />
            </a>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span style={{ color: '#666', fontSize: '0.9rem', fontWeight: '500' }}>
                {user.username}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  padding: '0.5rem 1.5rem',
                  backgroundColor: 'transparent',
                  color: '#000',
                  border: '1px solid #000',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#000';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#000';
            }}
          >
            Log out
          </button>
        </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem 2rem'
      }}>
        {/* Welcome Section */}
        <div style={{
          marginBottom: '3rem',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: 'bold',
            marginBottom: '1rem',
            letterSpacing: '-1px'
          }}>
            Welcome back, {user.username}
          </h1>
          <p style={{
            color: '#666',
            fontSize: '1.1rem'
          }}>
            Your dashboard is ready
          </p>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <div style={{
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '2rem',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e5e5e5';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}>
              0
            </div>
            <div style={{
              color: '#666',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Total Projects
            </div>
          </div>

          <div style={{
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '2rem',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e5e5e5';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}>
              0
            </div>
            <div style={{
              color: '#666',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Active Servers
            </div>
          </div>

          <div style={{
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '2rem',
            transition: 'all 0.3s',
            cursor: 'pointer'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = '#000';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = '#e5e5e5';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{
              fontSize: '2.5rem',
              fontWeight: 'bold',
              marginBottom: '0.5rem'
            }}>
              0
            </div>
            <div style={{
              color: '#666',
              fontSize: '0.9rem',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Total Members
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{
          marginBottom: '3rem'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            letterSpacing: '-0.5px'
          }}>
            Quick Actions
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <button style={{
              padding: '1.5rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.transform = 'scale(1.02)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#000';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              + Create Project
            </button>

            <button style={{
              padding: '1.5rem',
              backgroundColor: 'transparent',
              color: '#000',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#000';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#000';
              }}
            >
              View Analytics
            </button>

            <button style={{
              padding: '1.5rem',
              backgroundColor: 'transparent',
              color: '#000',
              border: '1px solid #000',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              textAlign: 'left'
            }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#000';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#000';
              }}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 'bold',
            marginBottom: '1.5rem',
            letterSpacing: '-0.5px'
          }}>
            Recent Activity
          </h2>
          <div style={{
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{
              color: '#666',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}>
              No recent activity
            </div>
            <p style={{
              color: '#999',
              fontSize: '0.9rem'
            }}>
              Your activity will appear here once you start using the platform
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer-section">
        <div className="container">
          <div className="footer-line"></div>
          <div className="footer-bottom">
            <div className="footer-brand">
              <div className="footer-logo">
                <img src="/discortize-logo.png" alt="Discortize" className="footer-logo-img" />
              </div>
              <div className="footer-copyright">© 2026 Discortize. All rights reserved.</div>
            </div>
            <div className="footer-links">
              <a href="#" className="footer-link">Features</a>
              <a href="#" className="footer-link">Pricing</a>
              <a href="#" className="footer-link">About</a>
              <a href="#" className="footer-link">Privacy</a>
              <a href="#" className="footer-link">Terms</a>
            </div>
            <div className="footer-socials">
              <a href="#" className="social-link">𝕏</a>
              <a href="#" className="social-link">💬</a>
              <a href="#" className="social-link">▶</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
