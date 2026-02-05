'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { startTokenRefresh, stopTokenRefresh, API_URL } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  email_verified: boolean;
  created_at?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
  bot_in_server: boolean;
}

interface DashboardStats {
  revenue: number;
  orders: number;
  customers: number;
  balance: number;
}

interface RevenueChartData {
  date: string;
  revenue: number;
  orders: number;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [loadingGuilds, setLoadingGuilds] = useState(false);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [revenueChartData, setRevenueChartData] = useState<RevenueChartData[]>([]);
  const [hoveredDataIndex, setHoveredDataIndex] = useState<number | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  
  // Date range picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedRange, setSelectedRange] = useState<'today' | '7days' | '30days' | '90days' | '365days' | 'all'>('30days');
  
  const dateRangeOptions = [
    { value: 'today', label: 'Today', days: 1 },
    { value: '7days', label: 'Last 7 Days', days: 7 },
    { value: '30days', label: 'Last 30 Days', days: 30 },
    { value: '90days', label: 'Last 90 Days', days: 90 },
    { value: '365days', label: 'This Year', days: 365 },
    { value: 'all', label: 'All Time', days: 3650 },
  ];
  
  const getDateRangeLabel = () => {
    return dateRangeOptions.find(opt => opt.value === selectedRange)?.label || 'Last 30 Days';
  };
  
  const getDateRangeDays = () => {
    return dateRangeOptions.find(opt => opt.value === selectedRange)?.days || 30;
  };
  
  // Withdrawal modal states
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawalStep, setWithdrawalStep] = useState<'confirm' | 'code' | 'processing' | 'success' | 'error'>('confirm');
  const [verificationCode, setVerificationCode] = useState('');
  const [withdrawalResult, setWithdrawalResult] = useState<any>(null);
  const [withdrawalError, setWithdrawalError] = useState<string>('');
  
  // Dashboard stats
  const [stats, setStats] = useState<DashboardStats>({
    revenue: 0,
    orders: 0,
    customers: 0,
    balance: 0
  });

  const fetchDashboardStats = async (token: string, days?: number) => {
    try {
      // Fetch crypto balance
      const balanceResponse = await fetch(`${API_URL}/api/crypto/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (balanceResponse.ok) {
        const balanceData = await balanceResponse.json();
        setStats(prev => ({
          ...prev,
          balance: balanceData.total_balance_usd || 0
        }));
      }

      // Fetch revenue stats for chart
      setLoadingChart(true);
      const daysParam = days || getDateRangeDays();
      const revenueResponse = await fetch(`${API_URL}/api/stats/revenue?days=${daysParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (revenueResponse.ok) {
        const revenueData = await revenueResponse.json();
        setRevenueChartData(revenueData.chart_data || []);
        setStats(prev => ({
          ...prev,
          revenue: revenueData.total_revenue || 0,
          orders: revenueData.total_orders || 0
        }));
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoadingChart(false);
    }
  };
  
  // Refetch when date range changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && !loading) {
      fetchDashboardStats(token);
    }
  }, [selectedRange]);

  useEffect(() => {
    const initializeDashboard = async () => {
      const token = localStorage.getItem('token');
      const refreshToken = localStorage.getItem('refresh_token');
      const userData = localStorage.getItem('user');

      if (!token || !userData || !refreshToken) {
        router.push('/login');
        return;
      }

      try {
        const parsedUser = JSON.parse(userData);
        
        // Verify token is valid before proceeding
        const verifyResponse = await fetch(`${API_URL}/api/discord/check-connection`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (verifyResponse.status === 401) {
          // Token expired, try to refresh
          console.log('Token expired, attempting refresh...');
          const refreshResponse = await fetch(`${API_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          
          if (refreshResponse.ok) {
            const data = await refreshResponse.json();
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            console.log('Token refreshed successfully');
            // Continue with the refreshed token
            setUser(data.user);
            setLoading(false);
            startTokenRefresh();
            
            fetchClientId();
            const code = searchParams.get('code');
            if (code) {
              handleOAuthCallback(code, data.access_token);
            } else {
              checkDiscordConnection(data.access_token);
            }
            fetchDashboardStats(data.access_token);
          } else {
            // Refresh failed, clear tokens and redirect to login
            console.log('Token refresh failed, redirecting to login');
            localStorage.removeItem('token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('user');
            router.push('/login');
            return;
          }
        } else {
          // Token is valid, proceed normally
          setUser(parsedUser);
          setLoading(false);
          startTokenRefresh();
          
          fetchClientId();
          const code = searchParams.get('code');
          if (code) {
            handleOAuthCallback(code, token);
          } else {
            checkDiscordConnection(token);
          }
          fetchDashboardStats(token);
        }
      } catch (error) {
        console.error('Error initializing dashboard:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        router.push('/login');
        return;
      }
    };

    initializeDashboard();

    return () => {
      stopTokenRefresh();
    };
  }, [router, searchParams]);

  const fetchClientId = async () => {
    try {
      const response = await fetch(`${API_URL}/api/discord/client-id`);
      if (response.ok) {
        const data = await response.json();
        setDiscordClientId(data.client_id);
      }
    } catch (error) {
      console.error('Error fetching Discord client ID:', error);
    }
  };

  const checkDiscordConnection = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/check-connection`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connected) {
          setDiscordUsername(data.username);
        }
      }
    } catch (error) {
      console.error('Error checking Discord connection:', error);
    } finally {
      setCheckingConnection(false);
    }
  };

  const requestWithdrawalCode = async () => {
    try {
      setWithdrawalStep('processing');
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/crypto/request-withdrawal-code`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Service unavailable' }));
        setWithdrawalError(errorData.detail || 'Failed to send verification code');
        setWithdrawalStep('error');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setWithdrawalStep('code');
      } else {
        setWithdrawalError(data.detail || 'Failed to send verification code');
        setWithdrawalStep('error');
      }
    } catch (error) {
      console.error('Error requesting withdrawal code:', error);
      setWithdrawalError('Network error. Please check your connection and try again.');
      setWithdrawalStep('error');
    }
  };

  const executeWithdrawal = async () => {
    try {
      setWithdrawalStep('processing');
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/crypto/withdraw-all`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verification_code: verificationCode
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Service unavailable' }));
        setWithdrawalError(errorData.detail || 'Withdrawal failed');
        setWithdrawalStep('error');
        setVerificationCode('');
        return;
      }

      const data = await response.json();
      
      if (data.success) {
        setWithdrawalResult(data);
        setWithdrawalStep('success');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        const errorMsg = data.detail || data.errors?.join(', ') || 'Withdrawal failed';
        setWithdrawalError(errorMsg);
        setWithdrawalStep('error');
        setVerificationCode('');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      setWithdrawalError('Network error. Please check your connection and try again.');
      setWithdrawalStep('error');
      setVerificationCode('');
    }
  };

  const handleOAuthCallback = async (code: string, token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/callback`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.discord_user) {
          setDiscordUsername(data.discord_user.username);
        }
        // Remove code from URL
        window.history.replaceState({}, '', '/dashboard');
      } else {
        console.error('Failed to connect Discord account');
      }
    } catch (error) {
      console.error('Error handling Discord callback:', error);
    }
  };

  const connectDiscord = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/discord/auth`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        window.location.href = data.auth_url;
      } else {
        alert('Failed to generate Discord authorization URL. Please try again.');
      }
    } catch (error) {
      console.error('Error connecting Discord:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleLogout = () => {
    stopTokenRefresh();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
    router.push('/');
  };

  const fetchGuilds = async () => {
    setLoadingGuilds(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/guilds`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGuilds(data.guilds || []);
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
    } finally {
      setLoadingGuilds(false);
    }
  };

  const handleServersClick = () => {
    router.push('/dashboard/servers');
  };

  useEffect(() => {
    if (pathname === '/dashboard/servers' && guilds.length === 0 && discordUsername) {
      fetchGuilds();
    }
  }, [pathname, discordUsername]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{
          border: '3px solid #000',
          borderTop: '3px solid transparent',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }} />
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
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
              <span style={{ color: '#666', fontSize: '0.9rem', marginRight: '0.5rem' }}>{user.username}</span>
              <button
                onClick={handleLogout}
                className="nav-login"
                style={{ cursor: 'pointer' }}
              >
                Log out
              </button>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{
        minHeight: 'calc(100vh - 400px)',
        padding: '4rem 2rem',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        paddingLeft: '20%',
        paddingTop: '2rem'
      }}>
        {/* Side Menu */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          width: '240px'
        }}>
          {/* Connect Discord Button */}
          {checkingConnection ? (
            <div
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #fff',
                  borderTopColor: 'transparent',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}
              />
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              Checking...
            </div>
          ) : (
            <button
              onClick={discordUsername ? undefined : connectDiscord}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '24px',
                fontSize: '0.9rem',
                fontWeight: '500',
                cursor: discordUsername ? 'default' : 'pointer',
                marginBottom: '1rem',
                transition: 'background-color 0.2s',
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center'
              }}
              onMouseOver={(e) => !discordUsername && (e.currentTarget.style.backgroundColor = '#333')}
              onMouseOut={(e) => !discordUsername && (e.currentTarget.style.backgroundColor = '#000')}
            >
              {discordUsername || 'Connect Discord'}
            </button>
          )}

          {/* Menu Items */}
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s',
              backgroundColor: pathname === '/dashboard' ? '#f5f5f5' : 'transparent'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = pathname === '/dashboard' ? '#f5f5f5' : 'transparent'}
          >
            <img src="/home-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Dashboard
          </Link>

          <button
            onClick={handleServersClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s',
              backgroundColor: pathname === '/dashboard/servers' ? '#f5f5f5' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              textAlign: 'left'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = pathname === '/dashboard/servers' ? '#f5f5f5' : 'transparent'}
          >
            <img src="/servers-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Servers
          </button>

          <Link
            href="/dashboard/subscriptions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/product-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Subscriptions
          </Link>

          <Link
            href="/dashboard/invoices"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/invoice-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Invoices
          </Link>

          <Link
            href="/dashboard/payments"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/buy-crypto-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Payments
          </Link>

          <Link
            href="/dashboard/payouts"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23"/>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            Payouts
          </Link>

          <Link
            href="/dashboard/plans"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            Plans
          </Link>

          <div style={{ margin: '0.5rem 0' }} />

          <Link
            href="/dashboard/notifications"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/notification-bell-1397-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Notifications
          </Link>

          <Link
            href="/dashboard/help"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '1.1rem',
              fontWeight: '700',
              borderRadius: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/help-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Help
          </Link>
        </div>

        {/* Content Area */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '1400px',
          width: '100%'
        }}>
          {pathname === '/dashboard' && (
            <>
              <h2 style={{ 
                fontSize: '1.575rem', 
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                color: '#000',
                margin: '0 0 1.5rem 0'
              }}>
                <img src="/home-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
                Dashboard
              </h2>

              {/* Balance Card */}
              <div style={{
                backgroundColor: '#000',
                color: '#fff',
                borderRadius: '16px',
                padding: '1.5rem 2rem',
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: '500', marginBottom: '0.25rem', color: 'rgba(255,255,255,0.7)' }}>
                    Available Balance
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: '700', letterSpacing: '-0.025em' }}>
                    ${stats.balance.toFixed(2)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowWithdrawModal(true);
                    setWithdrawalStep('confirm');
                    setVerificationCode('');
                  }}
                  style={{
                    backgroundColor: '#fff',
                    color: '#000',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.625rem 1.25rem',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#fff';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Withdraw
                </button>
              </div>

              {/* Statistics Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                marginBottom: '1.5rem'
              }}>
                {/* Revenue Card */}
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: '500' }}>Total Revenue</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#000', letterSpacing: '-0.025em' }}>${stats.revenue.toFixed(2)}</div>
                    </div>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23"></line>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Orders Card */}
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: '500' }}>Total Orders</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#000', letterSpacing: '-0.025em' }}>{stats.orders}</div>
                    </div>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Customers Card */}
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  transition: 'all 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#d1d5db';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e7eb';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: '500' }}>Customers</div>
                      <div style={{ fontSize: '1.75rem', fontWeight: '700', color: '#000', letterSpacing: '-0.025em' }}>{stats.customers}</div>
                    </div>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revenue & Orders Chart */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#000', margin: 0 }}>
                    Revenue & Orders
                  </h3>
                  
                  {/* Date Range Picker */}
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setShowDatePicker(!showDatePicker)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#000'}
                    >
                      <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor">
                        <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Z"/>
                      </svg>
                      {getDateRangeLabel()}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    
                    {/* Dropdown Menu */}
                    {showDatePicker && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 49 }}
                          onClick={() => setShowDatePicker(false)}
                        />
                        <div style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          backgroundColor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                          minWidth: '180px',
                          zIndex: 50,
                          overflow: 'hidden'
                        }}>
                          {dateRangeOptions.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => {
                                setSelectedRange(option.value as any);
                                setShowDatePicker(false);
                              }}
                              style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                backgroundColor: selectedRange === option.value ? '#f5f5f5' : 'transparent',
                                color: selectedRange === option.value ? '#000' : '#333',
                                border: 'none',
                                borderBottom: '1px solid #f0f0f0',
                                fontSize: '0.875rem',
                                fontWeight: selectedRange === option.value ? '600' : '400',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => {
                                if (selectedRange !== option.value) {
                                  e.currentTarget.style.backgroundColor = '#fafafa';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedRange !== option.value) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {loadingChart ? (
                  <div style={{
                    height: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      border: '3px solid #000',
                      borderTop: '3px solid transparent',
                      borderRadius: '50%',
                      width: '40px',
                      height: '40px',
                      animation: 'spin 1s linear infinite'
                    }} />
                  </div>
                ) : revenueChartData.length === 0 ? (
                  <div style={{
                    height: '300px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f9f9f9',
                    borderRadius: '8px',
                    color: '#666',
                    fontSize: '0.9rem'
                  }}>
                    No revenue data yet
                  </div>
                ) : (
                  <div style={{ position: 'relative', height: '320px', padding: '0 0 0 40px' }}>
                    {(() => {
                      // Aggregate data if there are too many points (for better visualization)
                      const aggregateData = (data: typeof revenueChartData, maxPoints: number) => {
                        if (data.length <= maxPoints) return data;
                        
                        const chunkSize = Math.ceil(data.length / maxPoints);
                        const aggregated: typeof revenueChartData = [];
                        
                        for (let i = 0; i < data.length; i += chunkSize) {
                          const chunk = data.slice(i, i + chunkSize);
                          const totalRevenue = chunk.reduce((sum, d) => sum + d.revenue, 0);
                          const totalOrders = chunk.reduce((sum, d) => sum + d.orders, 0);
                          aggregated.push({
                            date: chunk[Math.floor(chunk.length / 2)].date,
                            revenue: totalRevenue,
                            orders: totalOrders
                          });
                        }
                        return aggregated;
                      };
                      
                      // Limit to 60 points max for smooth visualization
                      const chartData = aggregateData(revenueChartData, 60);
                      
                      return (
                        <>
                    {/* SVG Area Chart */}
                    <svg
                      width="100%"
                      height="280"
                      style={{ overflow: 'visible' }}
                      viewBox="0 0 800 280"
                      preserveAspectRatio="none"
                      onMouseMove={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = ((e.clientX - rect.left) / rect.width) * 800;
                        const index = Math.round((x / 800) * (chartData.length - 1));
                        if (index >= 0 && index < chartData.length) {
                          setHoveredDataIndex(index);
                        }
                      }}
                      onMouseLeave={() => setHoveredDataIndex(null)}
                    >
                      <defs>
                        <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="rgba(0, 0, 0, 0.12)" />
                          <stop offset="100%" stopColor="rgba(0, 0, 0, 0.02)" />
                        </linearGradient>
                      </defs>
                      
                      {(() => {
                        const maxRevenue = Math.max(...chartData.map(d => d.revenue), 1);
                        const width = 800;
                        const height = 260;
                        const paddingTop = 30;
                        const paddingBottom = 20;
                        const chartHeight = height - paddingTop - paddingBottom;
                        
                        // Calculate points for the line with proper spacing
                        const dataLength = chartData.length;
                        const points = chartData.map((data, index) => {
                          const x = dataLength > 1 ? (index / (dataLength - 1)) * width : width / 2;
                          const y = paddingTop + chartHeight - (data.revenue / maxRevenue) * chartHeight;
                          return { x, y, data };
                        });
                        
                        // Create smooth curve using Catmull-Rom spline for better curves
                        const createSmoothPath = (pts: {x: number, y: number}[]) => {
                          if (pts.length < 2) return `M ${pts[0]?.x || 0} ${pts[0]?.y || 0}`;
                          if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
                          
                          let d = `M ${pts[0].x} ${pts[0].y}`;
                          
                          for (let i = 0; i < pts.length - 1; i++) {
                            const p0 = pts[Math.max(0, i - 1)];
                            const p1 = pts[i];
                            const p2 = pts[i + 1];
                            const p3 = pts[Math.min(pts.length - 1, i + 2)];
                            
                            // Control points for smooth bezier
                            const cp1x = p1.x + (p2.x - p0.x) / 6;
                            const cp1y = p1.y + (p2.y - p0.y) / 6;
                            const cp2x = p2.x - (p3.x - p1.x) / 6;
                            const cp2y = p2.y - (p3.y - p1.y) / 6;
                            
                            d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
                          }
                          
                          return d;
                        };
                        
                        const pathD = createSmoothPath(points);
                        
                        // Create area path (line + close to bottom)
                        const areaPath = `${pathD} L ${points[points.length - 1]?.x || width} ${height - paddingBottom} L ${points[0]?.x || 0} ${height - paddingBottom} Z`;
                        
                        // Get hovered point data
                        const hoveredPoint = hoveredDataIndex !== null ? points[hoveredDataIndex] : null;
                        
                        return (
                          <>
                            {/* Grid lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                              <line
                                key={i}
                                x1="0"
                                y1={paddingTop + chartHeight * (1 - ratio)}
                                x2={width}
                                y2={paddingTop + chartHeight * (1 - ratio)}
                                stroke="#e5e7eb"
                                strokeWidth="1"
                              />
                            ))}
                            
                            {/* Y-axis labels inside chart */}
                            {[1, 0.75, 0.5, 0.25, 0].map((ratio, i) => (
                              <text
                                key={i}
                                x="10"
                                y={paddingTop + chartHeight * (1 - ratio) + 4}
                                fontSize="11"
                                fill="#9ca3af"
                                fontFamily="system-ui, -apple-system, sans-serif"
                              >
                                ${(maxRevenue * ratio).toFixed(2)}
                              </text>
                            ))}
                            
                            {/* Area fill */}
                            <path
                              d={areaPath}
                              fill="url(#areaGradient)"
                            />
                            
                            {/* Line */}
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#000"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            
                            {/* Data points (small dots) */}
                            {points.map((point, index) => (
                              <circle
                                key={`dot-${index}`}
                                cx={point.x}
                                cy={point.y}
                                r={hoveredDataIndex === index ? 5 : 0}
                                fill="#000"
                                stroke="#fff"
                                strokeWidth="2"
                                style={{ transition: 'r 0.15s ease' }}
                              />
                            ))}
                            
                            {/* Hover vertical line */}
                            {hoveredPoint && (
                              <line
                                x1={hoveredPoint.x}
                                y1={paddingTop}
                                x2={hoveredPoint.x}
                                y2={height - paddingBottom}
                                stroke="#000"
                                strokeWidth="1"
                                strokeOpacity="0.2"
                              />
                            )}
                            
                            {/* Invisible hover areas for better interaction */}
                            {points.map((point, index) => (
                              <rect
                                key={index}
                                x={point.x - 15}
                                y={0}
                                width="30"
                                height={height}
                                fill="transparent"
                                style={{ cursor: 'pointer' }}
                              />
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                    
                    {/* Professional hover tooltip */}
                    {hoveredDataIndex !== null && chartData[hoveredDataIndex] && (
                      <div style={{
                        position: 'absolute',
                        top: '20px',
                        left: `${(hoveredDataIndex / Math.max(1, chartData.length - 1)) * 100}%`,
                        transform: `translateX(${hoveredDataIndex > chartData.length / 2 ? '-100%' : '0'})`,
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                        minWidth: '160px',
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '8px', fontWeight: '500' }}>
                          {new Date(chartData[hoveredDataIndex].date).toLocaleDateString('en-US', { 
                            weekday: 'short',
                            month: 'short', 
                            day: 'numeric'
                          })}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Revenue</span>
                            <span style={{ fontSize: '0.9375rem', color: '#000', fontWeight: '600' }}>
                              ${chartData[hoveredDataIndex].revenue.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Orders</span>
                            <span style={{ fontSize: '0.9375rem', color: '#000', fontWeight: '600' }}>
                              {chartData[hoveredDataIndex].orders}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* X-axis labels */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginTop: '10px',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      paddingLeft: '10px',
                      paddingRight: '10px'
                    }}>
                      {(() => {
                        // Calculate unique indices for x-axis labels
                        const len = chartData.length;
                        const indices = len <= 4 
                          ? Array.from({ length: len }, (_, i) => i)
                          : [...new Set([0, Math.floor(len / 3), Math.floor(len * 2 / 3), len - 1])];
                        
                        return indices.map((index, i) => {
                          const date = new Date(chartData[index].date);
                          return (
                            <div key={`xlabel-${i}-${index}`}>
                              {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          );
                        });
                      })()}
                    </div>
                    </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Latest Completed Orders */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#000' }}>
                  Recent Orders
                </h3>
                <div style={{
                  textAlign: 'center',
                  padding: '2.5rem 1rem',
                  color: '#9ca3af',
                  fontSize: '0.875rem'
                }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem' }}>
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <path d="M16 10a4 4 0 0 1-8 0"></path>
                  </svg>
                  <div>No completed orders yet</div>
                </div>
              </div>

              {/* Two Column Layout for Top Products and Customers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                {/* Top 5 Products */}
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#000' }}>
                    Top Products
                  </h3>
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    color: '#9ca3af',
                    fontSize: '0.875rem'
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem' }}>
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                      <line x1="12" y1="22.08" x2="12" y2="12"></line>
                    </svg>
                    <div>No products data yet</div>
                  </div>
                </div>

                {/* Top 5 Customers */}
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#000' }}>
                    Top Customers
                  </h3>
                  <div style={{
                    textAlign: 'center',
                    padding: '2rem 1rem',
                    color: '#9ca3af',
                    fontSize: '0.875rem'
                  }}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.75rem' }}>
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <div>No customers data yet</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {pathname === '/dashboard/servers' && (
            <>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1.5rem' }}>Your Servers</h2>
              
              {!discordUsername ? (
                <div style={{
                  padding: '2rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p style={{ marginBottom: '1rem' }}>Connect your Discord account to view your servers</p>
                  <button
                    onClick={connectDiscord}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Connect Discord
                  </button>
                </div>
              ) : loadingGuilds ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div style={{
                    border: '3px solid #000',
                    borderTop: '3px solid transparent',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto'
                  }} />
                </div>
              ) : guilds.length === 0 ? (
                <div style={{
                  padding: '2rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  textAlign: 'center'
                }}>
                  <p>No servers found</p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gap: '1rem',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))'
                }}>
                  {guilds.map((guild) => (
                    <div
                      key={guild.id}
                      style={{
                        padding: '1.25rem',
                        backgroundColor: '#fff',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                      }}
                    >
                      {guild.icon ? (
                        <img
                          src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                          alt={guild.name}
                          style={{
                            width: '48px',
                            height: '48px',
                            borderRadius: '50%'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          backgroundColor: '#5865F2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: '600',
                          fontSize: '1.25rem'
                        }}>
                          {guild.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{guild.name}</div>
                        {guild.bot_in_server ? (
                          <span style={{
                            fontSize: '0.75rem',
                            color: '#22c55e',
                            fontWeight: '500'
                          }}>
                            ✓ Bot Active
                          </span>
                        ) : (
                          <a
                            href={`https://discord.com/oauth2/authorize?client_id=${discordClientId || ''}&permissions=268520448&integration_type=0&scope=bot+applications.commands&guild_id=${guild.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.75rem',
                              color: '#5865F2',
                              textDecoration: 'none',
                              fontWeight: '500'
                            }}
                          >
                            Add Bot →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Withdrawal Modal */}
      {showWithdrawModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)'
        }} onClick={() => {
          if (withdrawalStep !== 'processing') {
            setShowWithdrawModal(false);
            setWithdrawalStep('confirm');
            setVerificationCode('');
          }
        }}>
          <div style={{
            background: '#000',
            borderRadius: '20px',
            padding: '2px',
            maxWidth: '500px',
            width: '90%',
            animation: 'slideIn 0.3s ease-out'
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              background: '#fff',
              borderRadius: '18px',
              padding: '2rem'
            }}>
              {withdrawalStep === 'confirm' && (
                <>
                  <div style={{
                    color: '#000',
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    marginBottom: '1rem',
                    textAlign: 'center'
                  }}>
                    Withdraw Funds
                  </div>
                  <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center', lineHeight: '1.6' }}>
                    This will withdraw all available balances to your configured payout addresses. 
                    A verification code will be sent to your email.
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button
                      onClick={() => {
                        setShowWithdrawModal(false);
                        setWithdrawalStep('confirm');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        borderRadius: '10px',
                        border: '2px solid #e0e0e0',
                        background: '#fff',
                        color: '#666',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={requestWithdrawalCode}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: '#000',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {withdrawalStep === 'code' && (
                <>
                  <div style={{
                    color: '#000',
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    marginBottom: '1rem',
                    textAlign: 'center'
                  }}>
                    Enter Verification Code
                  </div>
                  <p style={{ color: '#666', marginBottom: '1.5rem', textAlign: 'center', lineHeight: '1.6' }}>
                    We've sent a 6-digit code to your email. Please enter it below to confirm the withdrawal.
                  </p>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '1rem',
                      fontSize: '1.5rem',
                      textAlign: 'center',
                      letterSpacing: '0.5rem',
                      border: '2px solid #e0e0e0',
                      borderRadius: '10px',
                      marginBottom: '1.5rem',
                      fontWeight: '600',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#000'}
                    onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      onClick={() => {
                        setShowWithdrawModal(false);
                        setWithdrawalStep('confirm');
                        setVerificationCode('');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        borderRadius: '10px',
                        border: '2px solid #e0e0e0',
                        background: '#fff',
                        color: '#666',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeWithdrawal}
                      disabled={verificationCode.length !== 6}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        borderRadius: '10px',
                        border: 'none',
                        background: verificationCode.length === 6 ? '#000' : '#e0e0e0',
                        color: '#fff',
                        fontSize: '1rem',
                        fontWeight: '600',
                        cursor: verificationCode.length === 6 ? 'pointer' : 'not-allowed',
                        opacity: verificationCode.length === 6 ? 1 : 0.6
                      }}
                    >
                      Confirm
                    </button>
                  </div>
                </>
              )}

              {withdrawalStep === 'processing' && (
                <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #000',
                    borderRadius: '50%',
                    margin: '0 auto 1.5rem',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#333' }}>
                    Processing...
                  </div>
                  <p style={{ color: '#666', marginTop: '0.5rem' }}>
                    Please wait while we process your withdrawal
                  </p>
                </div>
              )}

              {withdrawalStep === 'error' && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: '#ef4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      fontSize: '2.5rem',
                      color: '#fff'
                    }}>
                      ✕
                    </div>
                    <div style={{
                      color: '#000',
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem'
                    }}>
                      Error
                    </div>
                    <p style={{ color: '#666', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                      {withdrawalError}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawalStep('confirm');
                      setVerificationCode('');
                      setWithdrawalError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#000',
                      color: '#fff',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </>
              )}

              {withdrawalStep === 'success' && withdrawalResult && (
                <>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                      width: '80px',
                      height: '80px',
                      borderRadius: '50%',
                      background: '#000',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 1rem',
                      fontSize: '2.5rem',
                      color: '#fff'
                    }}>
                      ✓
                    </div>
                    <div style={{
                      color: '#000',
                      fontSize: '1.75rem',
                      fontWeight: '700',
                      marginBottom: '0.5rem'
                    }}>
                      Withdrawal Successful
                    </div>
                    <p style={{ color: '#666', fontSize: '0.95rem' }}>
                      Your funds are on their way
                    </p>
                  </div>
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '1.5rem'
                  }}>
                    {withdrawalResult.payouts.map((payout: any, idx: number) => (
                      <div key={idx} style={{
                        marginBottom: idx < withdrawalResult.payouts.length - 1 ? '1rem' : 0,
                        paddingBottom: idx < withdrawalResult.payouts.length - 1 ? '1rem' : 0,
                        borderBottom: idx < withdrawalResult.payouts.length - 1 ? '1px solid #e0e0e0' : 'none'
                      }}>
                        <div style={{ fontWeight: '600', color: '#333', marginBottom: '0.5rem' }}>
                          {payout.amount} {payout.coin.toUpperCase()}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                          To: {payout.address.substring(0, 15)}...{payout.address.slice(-10)}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#000', fontFamily: 'monospace' }}>
                          TX: {payout.tx_id.substring(0, 15)}...
                        </div>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#666', textAlign: 'center', marginBottom: '1rem' }}>
                    Please allow a few minutes for blockchain confirmation.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    style={{
                      width: '100%',
                      padding: '0.875rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#000',
                      color: '#fff',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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

export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
