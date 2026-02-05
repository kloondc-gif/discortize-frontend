'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { startTokenRefresh, stopTokenRefresh, API_URL } from '@/lib/api';

interface User {
  id: string;
  email: string;
  username: string;
  email_verified: boolean;
  created_at?: string;
}

interface Subscriber {
  id: string;
  subscription_name: string;
  role_id: string;
  discord_user_id: string;
  discord_username?: string;
  discord_discriminator?: string;
  discord_avatar_url?: string;
  invoice_id: string;
  server_id: string;
  amount_usd: number;
  payment_coin: string;
  status: string;
  duration: string;
  duration_days: number | null;
  created_at: string;
  expires_at: string | null;
}

export default function SubscriptionsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  
  // Detail view state
  const [selectedSubscription, setSelectedSubscription] = useState<Subscriber | null>(null);
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [extendDays, setExtendDays] = useState(30);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter subscribers based on search query
  const filteredSubscribers = subscribers.filter(sub => {
    const query = searchQuery.toLowerCase();
    return (
      sub.subscription_name.toLowerCase().includes(query) ||
      sub.discord_user_id.toLowerCase().includes(query) ||
      (sub.discord_username && sub.discord_username.toLowerCase().includes(query)) ||
      sub.invoice_id.toLowerCase().includes(query)
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredSubscribers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSubscribers = filteredSubscribers.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    const userData = localStorage.getItem('user');

    if (!token || !userData || !refreshToken) {
      router.push('/login');
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      startTokenRefresh();
      
      fetchClientId();
      checkDiscordConnection(token);
      fetchSubscribers(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router]);

  const fetchClientId = async () => {
    try {
      const response = await fetch(`${API_URL}/api/env/discord-client-id`);
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

  const connectDiscord = () => {
    if (!discordClientId) return;

    const redirectUri = encodeURIComponent(`${API_URL}/api/discord/callback`);
    const scope = encodeURIComponent('identify');
    const state = localStorage.getItem('token') || '';

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;

    window.location.href = discordAuthUrl;
  };


  const fetchSubscribers = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/subscribers`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        router.push('/');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        // Filter out pending subscriptions, only show paid/completed ones
        const paidSubscribers = data.filter((sub: Subscriber) => 
          sub.status !== 'pending' && sub.status !== 'cancelled'
        );
        setSubscribers(paidSubscribers);
      } else {
        setError('Failed to fetch subscribers');
      }
    } catch (error) {
      console.error('Error fetching subscribers:', error);
      setError('Error loading subscribers');
    } finally {
      setLoading(false);
    }
  };

  const getAvatarUrl = (subscriber: Subscriber) => {
    // Use Discord avatar from backend, or fallback to default avatar
    return subscriber.discord_avatar_url || `https://cdn.discordapp.com/embed/avatars/${parseInt(subscriber.discord_user_id) % 5}.png`;
  };

  const getUserDisplay = (subscriber: Subscriber) => {
    // Show username with discriminator if available, otherwise show user ID
    if (subscriber.discord_username) {
      return subscriber.discord_discriminator && subscriber.discord_discriminator !== '0' 
        ? `${subscriber.discord_username}#${subscriber.discord_discriminator}`
        : subscriber.discord_username;
    }
    return `User ${subscriber.discord_user_id.substring(0, 8)}...`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCoinIcon = (coin: string) => {
    const coinLower = coin?.toLowerCase();
    if (coinLower === 'ltc' || coinLower === 'litecoin') {
      return '/litecoin-ltc-logo.svg';
    } else if (coinLower === 'sol' || coinLower === 'solana') {
      return '/solana-sol-logo.svg';
    }
    return '/buy-crypto-svgrepo-com.svg';
  };

  const getCoinName = (coin: string) => {
    const coinLower = coin?.toLowerCase();
    if (coinLower === 'ltc') return 'Litecoin';
    if (coinLower === 'sol') return 'Solana';
    return coin;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const handleRevoke = async () => {
    if (!selectedSubscription) return;
    setRevoking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/subscribers/${selectedSubscription.id}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setShowRevokeConfirm(false);
        setSelectedSubscription(null);
        // Refresh the list
        if (token) fetchSubscribers(token);
      } else {
        alert('Failed to revoke subscription');
      }
    } catch (error) {
      console.error('Error revoking subscription:', error);
      alert('Error revoking subscription');
    } finally {
      setRevoking(false);
    }
  };

  const handleExtend = async () => {
    if (!selectedSubscription) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/subscribers/${selectedSubscription.id}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ days: extendDays })
      });

      if (response.ok) {
        alert(`Subscription extended by ${extendDays} days`);
        setShowExtendForm(false);
        // Refresh the list
        if (token) fetchSubscribers(token);
      } else {
        alert('Failed to extend subscription');
      }
    } catch (error) {
      console.error('Error extending subscription:', error);
      alert('Error extending subscription');
    }
  };

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
              <span style={{ color: '#666', fontSize: '0.9rem', marginRight: '0.5rem' }}>{user?.username}</span>
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
        padding: '2rem 2rem 4rem 20%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start'
      }}>
        {/* Sidebar Navigation */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          width: '240px'
        }}>
          {/* Discord Connect Button */}
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
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <img src="/home-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Dashboard
          </Link>

          <Link
            href="/dashboard/servers"
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
            <img src="/servers-svgrepo-com.svg" alt="" style={{ width: '20px', height: '20px' }} />
            Servers
          </Link>

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
              transition: 'background-color 0.2s',
              backgroundColor: '#f5f5f5'
            }}
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

        {/* Subscribers Content */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '1400px',
          width: '100%'
        }}>
          {selectedSubscription ? (
            /* Detail View */
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <button
                  onClick={() => setSelectedSubscription(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'none',
                    border: 'none',
                    fontSize: '0.9rem',
                    color: '#666',
                    cursor: 'pointer',
                    padding: '0.5rem 0'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = '#000'}
                  onMouseOut={(e) => e.currentTarget.style.color = '#666'}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                  Back to Subscribers
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ 
                    fontSize: '1.575rem', 
                    fontWeight: '700',
                    color: '#000',
                    margin: '0 0 0.5rem 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <img src="/product-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
                    {selectedSubscription.subscription_name}
                  </h2>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                    Subscription Details
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowExtendForm(!showExtendForm)}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: '#f5f5f5',
                      color: '#000',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#e5e5e5';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#f5f5f5';
                    }}
                  >
                    Extend
                  </button>
                  <button
                    onClick={() => setShowRevokeConfirm(true)}
                    style={{
                      padding: '0.625rem 1.25rem',
                      backgroundColor: '#ef4444',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#dc2626';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                    }}
                  >
                    Revoke
                  </button>
                </div>
              </div>

              {showExtendForm && (
                <div style={{
                  padding: '1.5rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '12px',
                  marginBottom: '1.5rem',
                  border: '1px solid #e0e0e0'
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Extend Subscription</h3>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                      type="number"
                      value={extendDays}
                      onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                      placeholder="Days"
                      style={{
                        padding: '0.625rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid #e0e0e0',
                        fontSize: '0.875rem',
                        width: '100px'
                      }}
                    />
                    <span style={{ color: '#666', fontSize: '0.875rem' }}>days</span>
                    <button
                      onClick={handleExtend}
                      style={{
                        padding: '0.625rem 1.25rem',
                        backgroundColor: '#000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        cursor: 'pointer'
                      }}
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => setShowExtendForm(false)}
                      style={{
                        padding: '0.625rem 1.25rem',
                        backgroundColor: 'transparent',
                        color: '#666',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        fontSize: '0.875rem',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e0e0e0',
                overflow: 'hidden'
              }}>
                {/* Status Badge */}
                <div style={{
                  padding: '1.5rem',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <span style={{
                    padding: '0.375rem 1rem',
                    borderRadius: '20px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    textTransform: 'capitalize',
                    backgroundColor: 
                      selectedSubscription.status === 'paid' || selectedSubscription.status === 'confirmed' ? 'rgba(34, 197, 94, 0.15)' :
                      selectedSubscription.status === 'pending' ? 'rgba(59, 130, 246, 0.15)' :
                      selectedSubscription.status === 'revoked' ? 'rgba(239, 68, 68, 0.15)' : '#f0f0f0',
                    color:
                      selectedSubscription.status === 'paid' || selectedSubscription.status === 'confirmed' ? 'rgb(22, 163, 74)' :
                      selectedSubscription.status === 'pending' ? 'rgb(37, 99, 235)' :
                      selectedSubscription.status === 'revoked' ? 'rgb(220, 38, 38)' : '#666'
                  }}>
                    {selectedSubscription.status}
                  </span>
                  <span style={{ color: '#666', fontSize: '0.875rem' }}>
                    Created {formatDate(selectedSubscription.created_at)}
                  </span>
                </div>

                {/* User Info */}
                <div style={{
                  padding: '1.5rem',
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem'
                }}>
                  <img 
                    src={getAvatarUrl(selectedSubscription)}
                    alt=""
                    style={{ 
                      width: '56px', 
                      height: '56px', 
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #f0f0f0'
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#000' }}>
                      {getUserDisplay(selectedSubscription)}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                      Discord ID: {selectedSubscription.discord_user_id}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Amount
                      </div>
                      <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#000' }}>
                        ${selectedSubscription.amount_usd.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Payment Method
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img 
                          src={getCoinIcon(selectedSubscription.payment_coin)}
                          alt={selectedSubscription.payment_coin}
                          style={{ width: '24px', height: '24px' }}
                        />
                        <span style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                          {getCoinName(selectedSubscription.payment_coin)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Duration
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                        {selectedSubscription.duration}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Expires
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                        {selectedSubscription.expires_at 
                          ? new Date(selectedSubscription.expires_at).toLocaleDateString()
                          : 'N/A'
                        }
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Invoice ID
                      </div>
                      <button
                        onClick={() => router.push(`/dashboard/invoices/${selectedSubscription.invoice_id}`)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#3b82f6',
                          cursor: 'pointer',
                          fontSize: '1rem',
                          fontWeight: '500',
                          padding: '0',
                          textDecoration: 'none'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                        onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                      >
                        {selectedSubscription.invoice_id}
                      </button>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                        Role ID
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                        @{selectedSubscription.role_id}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Revoke Confirmation Modal */}
              {showRevokeConfirm && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000
                }}>
                  <div style={{
                    backgroundColor: '#fff',
                    borderRadius: '16px',
                    padding: '2rem',
                    maxWidth: '400px',
                    width: '90%',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)'
                  }}>
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1rem'
                      }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/>
                          <line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                      </div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#000', margin: '0 0 0.5rem' }}>
                        Revoke Subscription?
                      </h3>
                      <p style={{ color: '#666', fontSize: '0.9rem', margin: 0 }}>
                        This will remove the Discord role from <strong>{getUserDisplay(selectedSubscription)}</strong> and cannot be undone.
                      </p>
                    </div>

                    <div style={{
                      padding: '1rem',
                      backgroundColor: '#f9f9f9',
                      borderRadius: '8px',
                      marginBottom: '1.5rem'
                    }}>
                      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.25rem' }}>Subscription</div>
                      <div style={{ fontWeight: '600', color: '#000' }}>{selectedSubscription.subscription_name}</div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        onClick={() => setShowRevokeConfirm(false)}
                        disabled={revoking}
                        style={{
                          flex: 1,
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#f5f5f5',
                          color: '#000',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          cursor: revoking ? 'not-allowed' : 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRevoke}
                        disabled={revoking}
                        style={{
                          flex: 1,
                          padding: '0.75rem 1.5rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          cursor: revoking ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.5rem'
                        }}
                      >
                        {revoking ? (
                          <>
                            <div style={{
                              width: '16px',
                              height: '16px',
                              border: '2px solid #fff',
                              borderTopColor: 'transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            <style jsx>{`
                              @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                              }
                            `}</style>
                            Revoking...
                          </>
                        ) : (
                          'Revoke'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* List View */
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ 
              fontSize: '1.575rem', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#000',
              margin: 0
            }}>
              <img src="/product-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
              All Subscribers
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Total: {subscribers.length}
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ position: 'relative', maxWidth: '400px' }}>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#999" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search by subscription, user, or invoice ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 42px',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#000'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e0e0e0'}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#999',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                Found {filteredSubscribers.length} subscriber{filteredSubscribers.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: '1rem 1.5rem',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              border: '1px solid #ef9a9a',
              fontSize: '0.9rem'
            }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 2rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid #000',
                borderTop: '3px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto'
              }} />
              <style jsx>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>Loading subscribers...</p>
            </div>
          ) : subscribers.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 2rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <img src="/product-svgrepo-com.svg" alt="" style={{ width: '48px', height: '48px', opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0' }}>No subscribers yet</p>
              <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>Subscribers will appear here once users purchase subscriptions</p>
            </div>
          ) : filteredSubscribers.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 2rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}>
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0' }}>No subscribers match your search</p>
              <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>Try a different search term</p>
            </div>
          ) : (
            <>
            <div style={{ 
              backgroundColor: '#fff', 
              borderRadius: '8px', 
              overflow: 'hidden',
              border: '1px solid #e0e0e0'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1a1a1a' }}>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Status</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Subscription</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>User</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Invoice ID</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Amount</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Payment Method</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Duration</th>
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSubscribers.map((sub) => (
                    <tr 
                      key={sub.id}
                      onClick={() => setSelectedSubscription(sub)}
                      style={{
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background-color 0.2s',
                        cursor: 'pointer'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '8px',
                          fontSize: '0.875rem',
                          textTransform: 'capitalize',
                          fontWeight: '500',
                          backgroundColor: 
                            sub.status === 'paid' || sub.status === 'confirmed' ? 'rgba(34, 197, 94, 0.2)' :
                            sub.status === 'pending' ? 'rgba(59, 130, 246, 0.2)' :
                            sub.status === 'revoked' ? 'rgba(239, 68, 68, 0.2)' : '#f0f0f0',
                          color:
                            sub.status === 'paid' || sub.status === 'confirmed' ? 'rgb(34, 197, 94)' :
                            sub.status === 'pending' ? 'rgb(59, 130, 246)' :
                            sub.status === 'revoked' ? 'rgb(239, 68, 68)' : '#666',
                          border: `1px solid ${
                            sub.status === 'paid' || sub.status === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' :
                            sub.status === 'pending' ? 'rgba(59, 130, 246, 0.1)' :
                            sub.status === 'revoked' ? 'rgba(239, 68, 68, 0.1)' : '#e0e0e0'
                          }`
                        }}>
                          {sub.status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        <div>
                          <div style={{ fontWeight: '600' }}>{sub.subscription_name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                            @{sub.role_id}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img 
                            src={getAvatarUrl(sub)}
                            alt=""
                            style={{ 
                              width: '32px', 
                              height: '32px', 
                              borderRadius: '50%',
                              objectFit: 'cover'
                            }}
                          />
                          <div>
                            <div style={{ fontSize: '0.875rem', color: '#000', fontWeight: '500' }}>
                              {getUserDisplay(sub)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#666' }}>
                              ID: {sub.discord_user_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/invoices/${sub.invoice_id}`); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            padding: '0',
                            textDecoration: 'none'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {sub.invoice_id.slice(0, 8)}...
                        </button>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        ${sub.amount_usd.toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img 
                            src={getCoinIcon(sub.payment_coin)}
                            alt={sub.payment_coin}
                            style={{ width: '1.125rem', height: '1.125rem' }}
                          />
                          <span style={{ fontSize: '0.875rem', color: '#000', textTransform: 'capitalize' }}>
                            {getCoinName(sub.payment_coin)}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        <div>
                          {sub.duration}
                          {sub.expires_at && (
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                              Expires: {new Date(sub.expires_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        {formatDate(sub.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>
                  Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSubscribers.length)} of {filteredSubscribers.length}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: currentPage === 1 ? '#e0e0e0' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: currentPage === 1 ? '#999' : '#000'
                    }}
                  >
                    First
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: currentPage === 1 ? '#e0e0e0' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: currentPage === 1 ? '#999' : '#000'
                    }}
                  >
                    ← Prev
                  </button>
                  <div style={{
                    display: 'flex',
                    gap: '0.25rem'
                  }}>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          style={{
                            padding: '0.5rem 0.875rem',
                            backgroundColor: currentPage === pageNum ? '#000' : '#fff',
                            color: currentPage === pageNum ? '#fff' : '#000',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: currentPage === pageNum ? '600' : '400'
                          }}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: currentPage === totalPages ? '#999' : '#000'
                    }}
                  >
                    Next →
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '0.5rem 0.75rem',
                      backgroundColor: currentPage === totalPages ? '#e0e0e0' : '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '6px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      color: currentPage === totalPages ? '#999' : '#000'
                    }}
                  >
                    Last
                  </button>
                </div>
              </div>
            )}
            </>
          )}
            </>
          )}
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
