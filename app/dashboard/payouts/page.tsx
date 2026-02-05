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

interface Payout {
  id: string;
  invoice_id: string;
  crypto_type: string;
  amount: number;
  amount_usd: number;
  destination_address: string;
  tx_hash: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
}

export default function PayoutsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  
  // Payouts state
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loadingPayouts, setLoadingPayouts] = useState(true);
  const [autoPayoutEnabled, setAutoPayoutEnabled] = useState(false);
  const [togglingAutoPayout, setTogglingAutoPayout] = useState(false);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const itemsPerPage = 10;

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
      setLoading(false);
      startTokenRefresh();
      
      fetchClientId();
      checkDiscordConnection(token);
      fetchPayouts(token);
      fetchAutoPayoutStatus(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router]);

  const fetchPayouts = async (token: string) => {
    setLoadingPayouts(true);
    try {
      const response = await fetch(`${API_URL}/api/payouts`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPayouts(data.payouts || []);
        }
      }
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoadingPayouts(false);
    }
  };

  const fetchAutoPayoutStatus = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/payouts/auto-payout/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAutoPayoutEnabled(data.enabled || false);
      }
    } catch (error) {
      console.error('Error fetching auto-payout status:', error);
    }
  };

  const toggleAutoPayout = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setTogglingAutoPayout(true);
    try {
      const response = await fetch(`${API_URL}/api/payouts/auto-payout/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enabled: !autoPayoutEnabled })
      });

      if (response.ok) {
        const data = await response.json();
        setAutoPayoutEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error toggling auto-payout:', error);
    } finally {
      setTogglingAutoPayout(false);
    }
  };

  const fetchClientId = async () => {
    try {
      const response = await fetch(`${API_URL}/api/discord/client-id`);
      if (response.ok) {
        const data = await response.json();
        setDiscordClientId(data.client_id);
      }
    } catch (error) {
      console.error('Error fetching discord client ID:', error);
    }
  };

  const checkDiscordConnection = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/connection`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.discord_username) {
          setDiscordUsername(data.discord_username);
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
    
    const redirectUri = encodeURIComponent(`${window.location.origin}/dashboard/discord`);
    const scope = encodeURIComponent('identify guilds');
    const state = encodeURIComponent(Math.random().toString(36).substring(7));
    
    localStorage.setItem('discord_oauth_state', state);
    
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&state=${state}`;
    
    window.location.href = discordAuthUrl;
  };

  // Filter to only show completed payouts and apply search
  const filteredPayouts = payouts
    .filter(payout => payout.status === 'completed')
    .filter(payout =>
      payout.invoice_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.crypto_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.destination_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payout.tx_hash && payout.tx_hash.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  
  const totalPages = Math.ceil(filteredPayouts.length / itemsPerPage);
  const paginatedPayouts = filteredPayouts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getCryptoLogo = (cryptoType: string) => {
    const logos: {[key: string]: string} = {
      'ltc': '/litecoin-ltc-logo.svg',
      'sol': '/solana-sol-logo.svg',
      'eth': '/ethereum-eth-logo.svg',
      'btc': '/bitcoin-btc-logo.svg'
    };
    return logos[cryptoType.toLowerCase()] || '/buy-crypto-svgrepo-com.svg';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getExplorerUrl = (cryptoType: string, txHash: string) => {
    const explorers: {[key: string]: string} = {
      'ltc': `https://blockchair.com/litecoin/transaction/${txHash}`,
      'sol': `https://solscan.io/tx/${txHash}`,
      'eth': `https://etherscan.io/tx/${txHash}`,
      'btc': `https://blockchair.com/bitcoin/transaction/${txHash}`
    };
    return explorers[cryptoType.toLowerCase()] || `#`;
  };

  const formatAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
    stopTokenRefresh();
    router.push('/');
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
              <div style={{
                border: '2px solid #fff',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                width: '16px',
                height: '16px',
                animation: 'spin 1s linear infinite'
              }} />
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
              transition: 'background-color 0.2s',
              backgroundColor: '#f5f5f5'
            }}
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

        {/* Main Content */}
        <div style={{ flex: 1, paddingLeft: '5rem', maxWidth: '900px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
            <h2 style={{ 
              fontSize: '1.75rem', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#000'
            }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                backgroundColor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
              Payouts
            </h2>

            {/* Auto-payout Toggle */}
            <button
              onClick={toggleAutoPayout}
              disabled={togglingAutoPayout}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.625rem 1.25rem',
                backgroundColor: autoPayoutEnabled ? '#000' : '#fff',
                color: autoPayoutEnabled ? '#fff' : '#000',
                border: autoPayoutEnabled ? '1px solid #000' : '1px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: togglingAutoPayout ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: togglingAutoPayout ? 0.7 : 1
              }}
              onMouseOver={(e) => !togglingAutoPayout && !autoPayoutEnabled && (e.currentTarget.style.borderColor = '#000')}
              onMouseOut={(e) => !togglingAutoPayout && !autoPayoutEnabled && (e.currentTarget.style.borderColor = '#e0e0e0')}
            >
              {togglingAutoPayout ? (
                <>
                  <div style={{
                    border: `2px solid ${autoPayoutEnabled ? '#fff' : '#000'}`,
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    width: '16px',
                    height: '16px',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <style jsx>{`
                    @keyframes spin {
                      0% { transform: rotate(0deg); }
                      100% { transform: rotate(360deg); }
                    }
                  `}</style>
                </>
              ) : (
                <>
                  <div style={{
                    width: '40px',
                    height: '22px',
                    backgroundColor: autoPayoutEnabled ? '#22c55e' : '#e5e7eb',
                    borderRadius: '11px',
                    position: 'relative',
                    transition: 'background-color 0.2s'
                  }}>
                    <div style={{
                      width: '18px',
                      height: '18px',
                      backgroundColor: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '2px',
                      left: autoPayoutEnabled ? '20px' : '2px',
                      transition: 'left 0.2s',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                    }} />
                  </div>
                </>
              )}
              Auto-payout {autoPayoutEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {/* Info Banner */}
          <div style={{
            backgroundColor: '#fafafa',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            padding: '1rem 1.5rem',
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.95rem', color: '#000', fontWeight: '600', marginBottom: '0.25rem' }}>Auto-payout</div>
              <div style={{ fontSize: '0.85rem', color: '#6b7280', lineHeight: '1.5' }}>
                Automatically sends funds from paid invoices to your wallet. Configure addresses in <Link href="/dashboard/payments" style={{ color: '#000', fontWeight: '500' }}>Payments</Link>.
              </div>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
            <svg 
              width="18" 
              height="18" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="#9ca3af" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              style={{ 
                position: 'absolute', 
                left: '1rem', 
                top: '50%', 
                transform: 'translateY(-50%)' 
              }}
            >
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search completed payouts..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                width: '100%',
                padding: '0.875rem 1rem 0.875rem 2.75rem',
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#000';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,0,0,0.05)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e0e0e0';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
          </div>

          {/* Payouts List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loadingPayouts ? (
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                padding: '3rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  border: '3px solid #000',
                  borderTop: '3px solid transparent',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  animation: 'spin 1s linear infinite'
                }} />
              </div>
            ) : paginatedPayouts.length === 0 ? (
              <div style={{
                backgroundColor: '#fafafa',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '4rem 2rem',
                textAlign: 'center'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem'
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <p style={{ color: '#374151', fontSize: '1rem', fontWeight: '600' }}>
                  {searchQuery ? 'No payouts match your search' : 'No completed payouts yet'}
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.5rem', maxWidth: '300px', margin: '0.5rem auto 0' }}>
                  {searchQuery ? 'Try a different search term' : 'Completed payouts will appear here once invoices are paid and processed'}
                </p>
              </div>
            ) : (
              paginatedPayouts.map((payout) => (
                <div
                  key={payout.id}
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #e0e0e0',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s, border-color 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = '#d0d0d0';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  <div style={{
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '1.25rem'
                  }}>
                    {/* Crypto Logo */}
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <img 
                        src={getCryptoLogo(payout.crypto_type)} 
                        alt={payout.crypto_type}
                        style={{ width: '28px', height: '28px' }}
                      />
                    </div>
                    
                    {/* Payout Details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '700', fontSize: '1.1rem', color: '#000' }}>
                          {payout.amount} {payout.crypto_type.toUpperCase()}
                        </span>
                        {payout.amount_usd > 0 && (
                          <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                            ${payout.amount_usd.toFixed(2)}
                          </span>
                        )}
                        <span style={{
                          padding: '0.25rem 0.625rem',
                          backgroundColor: '#dcfce7',
                          color: '#16a34a',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          Completed
                        </span>
                      </div>
                      
                      <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: '#9ca3af', minWidth: '70px' }}>Invoice:</span>
                          <span style={{ fontFamily: 'monospace', color: '#374151', fontSize: '0.8rem' }}>{payout.invoice_id}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <span style={{ color: '#9ca3af', minWidth: '70px' }}>To:</span>
                          <span style={{ fontFamily: 'monospace', color: '#374151', fontSize: '0.8rem', wordBreak: 'break-all' }}>{payout.destination_address}</span>
                        </div>
                        {payout.tx_hash && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                            <span style={{ color: '#9ca3af', minWidth: '70px' }}>TX:</span>
                            <a 
                              href={getExplorerUrl(payout.crypto_type, payout.tx_hash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ 
                                fontFamily: 'monospace', 
                                color: '#000', 
                                fontSize: '0.8rem', 
                                wordBreak: 'break-all',
                                textDecoration: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.375rem',
                                padding: '0.25rem 0.5rem',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '6px',
                                transition: 'background-color 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e8e8e8'}
                              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                            >
                              {payout.tx_hash}
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Date/Time */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.9rem', color: '#374151', fontWeight: '500' }}>
                        {new Date(payout.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                        {new Date(payout.created_at).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.75rem',
              marginTop: '2rem',
              padding: '1rem 0'
            }}>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: currentPage === 1 ? '#f5f5f5' : '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  color: currentPage === 1 ? '#9ca3af' : '#fff',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => currentPage !== 1 && (e.currentTarget.style.backgroundColor = '#333')}
                onMouseOut={(e) => currentPage !== 1 && (e.currentTarget.style.backgroundColor = '#000')}
              >
                ← Previous
              </button>
              
              <span style={{ 
                fontSize: '0.875rem', 
                color: '#374151', 
                padding: '0.5rem 1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                fontWeight: '500'
              }}>
                {currentPage} / {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: currentPage === totalPages ? '#f5f5f5' : '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  color: currentPage === totalPages ? '#9ca3af' : '#fff',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => currentPage !== totalPages && (e.currentTarget.style.backgroundColor = '#333')}
                onMouseOut={(e) => currentPage !== totalPages && (e.currentTarget.style.backgroundColor = '#000')}
              >
                Next →
              </button>
            </div>
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
