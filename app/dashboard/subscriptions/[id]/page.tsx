'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function SubscriptionDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subscriptionId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscriber | null>(null);
  const [loading, setLoading] = useState(true);
  const [extendDays, setExtendDays] = useState(30);
  const [showExtendForm, setShowExtendForm] = useState(false);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
  const [revoking, setRevoking] = useState(false);

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
      fetchSubscriptionDetails(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router, subscriptionId]);

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

  const fetchSubscriptionDetails = async (token: string) => {
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
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const sub = data.find((s: Subscriber) => s.id === subscriptionId);
        
        if (sub) {
          setSubscription(sub);
        } else {
          router.push('/dashboard/subscriptions');
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching subscription details:', error);
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/subscribers/${subscriptionId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setShowRevokeConfirm(false);
        router.push('/dashboard/subscriptions');
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
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/subscribers/${subscriptionId}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ days: extendDays })
      });

      if (response.ok) {
        alert(`Subscription extended by ${extendDays} days`);
        if (token) fetchSubscriptionDetails(token);
        setShowExtendForm(false);
      } else {
        alert('Failed to extend subscription');
      }
    } catch (error) {
      console.error('Error extending subscription:', error);
      alert('Error extending subscription');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getAvatarUrl = (sub: Subscriber) => {
    return sub.discord_avatar_url || `https://cdn.discordapp.com/embed/avatars/${parseInt(sub.discord_user_id) % 5}.png`;
  };

  const getUserDisplay = (sub: Subscriber) => {
    if (sub.discord_username) {
      return sub.discord_discriminator && sub.discord_discriminator !== '0' 
        ? `${sub.discord_username}#${sub.discord_discriminator}`
        : sub.discord_username;
    }
    return `User ${sub.discord_user_id.substring(0, 8)}...`;
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff'
      }}>
        <div style={{ fontSize: '1.125rem', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  if (!user || !subscription) {
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

        {/* Subscription Details Content */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '1400px',
          width: '100%'
        }}>
          {/* Back Button */}
          <Link
            href="/dashboard/subscriptions"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginBottom: '1.5rem',
              color: '#000',
              textDecoration: 'none',
              fontSize: '0.9rem',
              fontWeight: '500'
            }}
            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            ← Back to Subscribers
          </Link>

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
              Subscription Details
            </h2>
          </div>

          {/* Subscription Info Card */}
          <div style={{ 
            backgroundColor: '#fff', 
            borderRadius: '8px', 
            border: '1px solid #e0e0e0',
            marginBottom: '1.5rem'
          }}>
            {/* User Info Section */}
            <div style={{ 
              padding: '1.5rem', 
              borderBottom: '1px solid #f0f0f0'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                User Information
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <img 
                  src={getAvatarUrl(subscription)}
                  alt=""
                  style={{ 
                    width: '64px', 
                    height: '64px', 
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#000', marginBottom: '0.25rem' }}>
                    {getUserDisplay(subscription)}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    User ID: {subscription.discord_user_id}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Details Section */}
            <div style={{ 
              padding: '1.5rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem'
            }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Subscription
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                  {subscription.subscription_name}
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                  Role ID: @{subscription.role_id}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Status
                </div>
                <span style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  textTransform: 'capitalize',
                  fontWeight: '500',
                  backgroundColor: 
                    subscription.status === 'paid' || subscription.status === 'confirmed' ? 'rgba(34, 197, 94, 0.2)' :
                    subscription.status === 'pending' ? 'rgba(59, 130, 246, 0.2)' :
                    subscription.status === 'revoked' ? 'rgba(239, 68, 68, 0.2)' : '#f0f0f0',
                  color:
                    subscription.status === 'paid' || subscription.status === 'confirmed' ? 'rgb(34, 197, 94)' :
                    subscription.status === 'pending' ? 'rgb(59, 130, 246)' :
                    subscription.status === 'revoked' ? 'rgb(239, 68, 68)' : '#666',
                  border: `1px solid ${
                    subscription.status === 'paid' || subscription.status === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' :
                    subscription.status === 'pending' ? 'rgba(59, 130, 246, 0.1)' :
                    subscription.status === 'revoked' ? 'rgba(239, 68, 68, 0.1)' : '#e0e0e0'
                  }`
                }}>
                  {subscription.status}
                </span>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Amount
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#000' }}>
                  ${subscription.amount_usd.toFixed(2)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Payment Method
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <img 
                    src={getCoinIcon(subscription.payment_coin)}
                    alt={subscription.payment_coin}
                    style={{ width: '1.5rem', height: '1.5rem' }}
                  />
                  <span style={{ fontSize: '1rem', color: '#000', fontWeight: '500' }}>
                    {getCoinName(subscription.payment_coin)}
                  </span>
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Duration
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000' }}>
                  {subscription.duration}
                </div>
                {subscription.expires_at && (
                  <div style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
                    Expires: {new Date(subscription.expires_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Invoice ID
                </div>
                <button
                  onClick={() => window.open(`/invoice/${subscription.invoice_id}`, '_blank')}
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
                  {subscription.invoice_id}
                </button>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Created At
                </div>
                <div style={{ fontSize: '0.875rem', color: '#000' }}>
                  {formatDate(subscription.created_at)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                  Server ID
                </div>
                <div style={{ fontSize: '0.875rem', color: '#000', fontFamily: 'monospace' }}>
                  {subscription.server_id}
                </div>
              </div>
            </div>
          </div>

          {/* Actions Section */}
          {subscription.status !== 'revoked' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '1.5rem'
            }}>
              {/* Extend Subscription Card */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '1.5rem'
              }}>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#000', marginBottom: '0.5rem' }}>
                  Extend Subscription
                </div>
                <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
                  Add additional days to this subscription
                </div>
                
                {!showExtendForm ? (
                  <button
                    onClick={() => setShowExtendForm(true)}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Extend
                  </button>
                ) : (
                  <div>
                    <input
                      type="number"
                      value={extendDays}
                      onChange={(e) => setExtendDays(parseInt(e.target.value))}
                      placeholder="Days to extend"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #e0e0e0',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        marginBottom: '0.75rem'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={handleExtend}
                        style={{
                          flex: 1,
                          padding: '0.5rem 1rem',
                          backgroundColor: '#000',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={() => setShowExtendForm(false)}
                        style={{
                          flex: 1,
                          padding: '0.5rem 1rem',
                          backgroundColor: '#f5f5f5',
                          color: '#000',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Revoke Subscription Card */}
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '1.5rem'
              }}>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.5rem' }}>
                  Revoke Subscription
                </div>
                <div style={{ fontSize: '0.875rem', color: '#991b1b', marginBottom: '1rem' }}>
                  Remove the role and notify the user
                </div>
                <button
                  onClick={() => setShowRevokeConfirm(true)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Revoke Confirmation Modal */}
      {showRevokeConfirm && (
        <div
          style={{
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
          }}
          onClick={() => !revoking && setShowRevokeConfirm(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '12px',
              padding: '2rem',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#fef2f2',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#000', margin: '0 0 0.5rem' }}>
                Revoke Subscription?
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#666', margin: 0, lineHeight: '1.5' }}>
                This will remove the <strong>{subscription?.subscription_name}</strong> role from <strong>{getUserDisplay(subscription!)}</strong> and send them a notification.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowRevokeConfirm(false)}
                disabled={revoking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#f5f5f5',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: revoking ? 'not-allowed' : 'pointer',
                  opacity: revoking ? 0.5 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                style={{
                  flex: 1,
                  padding: '0.75rem 1rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
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
                    Revoking...
                  </>
                ) : (
                  'Revoke Subscription'
                )}
              </button>
            </div>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
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
