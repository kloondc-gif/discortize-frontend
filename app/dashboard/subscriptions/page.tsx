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
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendDays, setExtendDays] = useState<{[key: string]: number}>({});
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  const handleRevoke = async (paymentId: string) => {
    if (!confirm('Are you sure you want to revoke this subscription?')) return;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/discord/subscribers/${paymentId}/revoke`, {
        method: 'POST',
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
        setToastMessage('Subscription revoked successfully');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        fetchSubscribers(token);
      } else {
        alert('Failed to revoke subscription');
      }
    } catch (error) {
      console.error('Error revoking subscription:', error);
      alert('Error revoking subscription');
    }
  };

  const handleExtend = async (paymentId: string) => {
    const days = extendDays[paymentId] || 30;
    
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${API_URL}/api/discord/subscribers/${paymentId}/extend?days=${days}`, {
        method: 'POST',
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
        setExtendingId(null);
        setToastMessage(`Subscription extended by ${days} days`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        fetchSubscribers(token);
      } else {
        alert('Failed to extend subscription');
      }
    } catch (error) {
      console.error('Error extending subscription:', error);
      alert('Error extending subscription');
    }
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
          ) : (
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
                    <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.map((sub) => (
                    <tr 
                      key={sub.id}
                      style={{
                        borderBottom: '1px solid #f0f0f0',
                        transition: 'background-color 0.2s'
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
                          onClick={() => window.open(`/invoice/${sub.invoice_id}`, '_blank')}
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
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'flex-end' }}>
                          {extendingId === sub.id ? (
                            <>
                              <input
                                type="number"
                                min="1"
                                value={extendDays[sub.id] || 30}
                                onChange={(e) => setExtendDays({...extendDays, [sub.id]: parseInt(e.target.value)})}
                                style={{
                                  width: '60px',
                                  padding: '0.25rem 0.5rem',
                                  border: '1px solid #ddd',
                                  borderRadius: '4px',
                                  fontSize: '0.75rem'
                                }}
                              />
                              <button
                                onClick={() => handleExtend(sub.id)}
                                style={{
                                  background: '#22c55e',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => setExtendingId(null)}
                                style={{
                                  background: '#ef4444',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem',
                                  fontWeight: '500'
                                }}
                              >
                                ✕
                              </button>
                            </>
                          ) : (
                            <>
                              {sub.status !== 'revoked' && (
                                <>
                                  <button
                                    onClick={() => setExtendingId(sub.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#3b82f6',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      fontWeight: '500',
                                      padding: '0',
                                      textDecoration: 'none',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                  >
                                    Extend
                                  </button>
                                  <button
                                    onClick={() => handleRevoke(sub.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#ef4444',
                                      cursor: 'pointer',
                                      fontSize: '0.875rem',
                                      fontWeight: '500',
                                      padding: '0',
                                      textDecoration: 'none',
                                      whiteSpace: 'nowrap'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                                  >
                                    Revoke
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Toast Notification */}
      {showToast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: '#1a1a1a',
            color: '#fff',
            padding: '1rem 1.5rem',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1001,
            fontSize: '0.95rem',
            fontWeight: '500',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {toastMessage}
          <style jsx>{`
            @keyframes slideIn {
              from {
                transform: translateY(100%);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
          `}</style>
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
