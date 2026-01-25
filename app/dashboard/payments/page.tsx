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

interface CryptoPayment {
  id: string;
  name: string;
  symbol: string;
  logo: string;
  enabled: boolean;
}

interface CryptoConfig {
  address: string;
  enabled: boolean;
  created_at: string;
}

interface FormData {
  address: string;
  otp: string;
}

export default function PaymentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  
  // Crypto configuration state
  const [expandedCoin, setExpandedCoin] = useState<string | null>(null);
  const [configs, setConfigs] = useState<{[key: string]: CryptoConfig}>({});
  const [formData, setFormData] = useState<{[key: string]: FormData}>({});
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});
  const [otpSent, setOtpSent] = useState<{[key: string]: boolean}>({});
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [otpCooldowns, setOtpCooldowns] = useState<{[key: string]: number}>({});

  const cryptoPayments = [
    { id: 'ltc', name: 'Litecoin', symbol: 'LTC', logo: '/litecoin-ltc-logo.svg', enabled: false },
    { id: 'sol', name: 'Solana', symbol: 'SOL', logo: '/solana-sol-logo.svg', enabled: false },
    { id: 'eth', name: 'Ethereum', symbol: 'ETH', logo: '/ethereum-eth-logo.svg', enabled: false },
    { id: 'btc', name: 'Bitcoin', symbol: 'BTC', logo: '/bitcoin-btc-logo.svg', enabled: false },
  ];

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
      fetchCryptoConfigs(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router]);

  const fetchCryptoConfigs = async (token: string) => {
    try {
      const response = await fetch('http://localhost:8000/api/crypto/config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.configs) {
          setConfigs(data.configs);
        }
      }
    } catch (error) {
      console.error('Error fetching crypto configs:', error);
    }
  };

  const handleConfigure = (coinId: string) => {
    if (expandedCoin === coinId) {
      setExpandedCoin(null);
    } else {
      setExpandedCoin(coinId);
      // Initialize form data for this coin if not exists
      if (!formData[coinId]) {
        setFormData(prev => ({
          ...prev,
          [coinId]: { address: configs[coinId]?.address || '', otp: '' }
        }));
      }
    }
  };

  const handleGetCode = async (coinId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setLoadingStates(prev => ({ ...prev, [`${coinId}_otp`]: true }));
    setErrors(prev => ({ ...prev, [coinId]: '' }));

    try {
      const response = await fetch(`http://localhost:8000/api/crypto/config/request-otp?coin=${coinId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOtpSent(prev => ({ ...prev, [coinId]: true }));
        
        // Start 30-second cooldown
        setOtpCooldowns(prev => ({ ...prev, [coinId]: 30 }));
        const interval = setInterval(() => {
          setOtpCooldowns(prev => {
            const newTime = (prev[coinId] || 0) - 1;
            if (newTime <= 0) {
              clearInterval(interval);
              return { ...prev, [coinId]: 0 };
            }
            return { ...prev, [coinId]: newTime };
          });
        }, 1000);
        
        // Show professional success message
        setErrors(prev => ({ 
          ...prev, 
          [coinId]: `SUCCESS:Verification code sent to ${user?.email}` 
        }));
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setErrors(prev => ({ ...prev, [coinId]: '' }));
        }, 5000);
      } else {
        setErrors(prev => ({ ...prev, [coinId]: data.detail || 'Failed to send OTP' }));
      }
    } catch (error) {
      console.error('Error requesting OTP:', error);
      setErrors(prev => ({ ...prev, [coinId]: 'Network error. Please try again.' }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [`${coinId}_otp`]: false }));
    }
  };

  const handleSave = async (coinId: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const data = formData[coinId];
    if (!data?.address || !data?.otp) {
      setErrors(prev => ({ ...prev, [coinId]: 'Please enter both address and OTP code' }));
      return;
    }

    setLoadingStates(prev => ({ ...prev, [`${coinId}_save`]: true }));
    setErrors(prev => ({ ...prev, [coinId]: '' }));

    try {
      const response = await fetch(
        `http://localhost:8000/api/crypto/config/save?coin=${coinId}&address=${encodeURIComponent(data.address)}&otp_code=${data.otp}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        // Success - show professional message
        setErrors(prev => ({ 
          ...prev, 
          [coinId]: `SUCCESS:${coinId.toUpperCase()} configuration saved successfully` 
        }));

        // Refresh configs
        fetchCryptoConfigs(token);

        // Reset form
        setFormData(prev => ({
          ...prev,
          [coinId]: { address: '', otp: '' }
        }));
        setOtpSent(prev => ({ ...prev, [coinId]: false }));
        setExpandedCoin(null);
        
        // Clear success message after 5 seconds
        setTimeout(() => {
          setErrors(prev => ({ ...prev, [coinId]: '' }));
        }, 5000);
      } else {
        setErrors(prev => ({ ...prev, [coinId]: result.detail || 'Failed to save configuration' }));
      }
    } catch (error) {
      console.error('Error saving config:', error);
      setErrors(prev => ({ ...prev, [coinId]: 'Network error. Please try again.' }));
    } finally {
      setLoadingStates(prev => ({ ...prev, [`${coinId}_save`]: false }));
    }
  };

  const fetchClientId = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/discord/client-id');
      if (response.ok) {
        const data = await response.json();
        setDiscordClientId(data.client_id);
      }
    } catch (error) {
      console.error('Error fetching Discord client ID:', error);
    }
  };

  const checkDiscordConnection = async (token: string) => {
    setCheckingConnection(true);
    try {
      const response = await fetch('http://localhost:8000/api/discord/connection', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.connected && data.discord_user) {
          setDiscordUsername(data.discord_user.username);
        }
      }
    } catch (error) {
      console.error('Error checking Discord connection:', error);
    } finally {
      setCheckingConnection(false);
    }
  };

  const connectDiscord = () => {
    if (!discordClientId) {
      console.error('Discord client ID not available');
      return;
    }

    const redirectUri = encodeURIComponent('http://localhost:3000/dashboard');
    const scope = encodeURIComponent('identify email guilds');
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;
    window.location.href = discordAuthUrl;
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
            Products/Subscriptions
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
              transition: 'background-color 0.2s',
              backgroundColor: '#f5f5f5'
            }}
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

        {/* Payments Content */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '900px'
        }}>
          <h2 style={{ 
            fontSize: '1.575rem', 
            fontWeight: '700', 
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#000'
          }}>
            <img src="/buy-crypto-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
            Payments
          </h2>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            {cryptoPayments.map((crypto) => (
              <div
                key={crypto.id}
                style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                {/* Crypto Header */}
                <div
                  style={{
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem'
                  }}
                >
                  <img
                    src={crypto.logo}
                    alt={crypto.name}
                    style={{
                      width: '40px',
                      height: '40px'
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                      {crypto.symbol}
                    </div>
                    {configs[crypto.id] && (
                      <div style={{ fontSize: '0.9rem', color: '#22c55e', marginTop: '0.25rem', fontWeight: '600' }}>
                        Configured
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleConfigure(crypto.id)}
                    style={{
                      padding: '0.5rem 1.5rem',
                      backgroundColor: expandedCoin === crypto.id ? '#333' : '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.9rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = expandedCoin === crypto.id ? '#333' : '#000'}
                  >
                    {expandedCoin === crypto.id ? 'Cancel' : 'Configure'}
                  </button>
                </div>

                {/* Expandable Form */}
                {expandedCoin === crypto.id && (
                  <div style={{
                    padding: '1.5rem',
                    backgroundColor: '#f9f9f9',
                    borderTop: '1px solid #e0e0e0'
                  }}>
                    {/* Current Config Display */}
                    {configs[crypto.id] && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: '#e8f5e9',
                        border: '1px solid #a5d6a7',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem'
                      }}>
                        <strong>Current Address:</strong> {configs[crypto.id].address}
                      </div>
                    )}

                    {/* Error/Success Message */}
                    {errors[crypto.id] && (
                      <div style={{
                        padding: '0.75rem 1rem',
                        backgroundColor: errors[crypto.id].startsWith('SUCCESS:') ? '#e8f5e9' : '#ffebee',
                        border: errors[crypto.id].startsWith('SUCCESS:') ? '1px solid #66bb6a' : '1px solid #ef5350',
                        borderRadius: '6px',
                        marginBottom: '1rem',
                        fontSize: '0.85rem',
                        color: errors[crypto.id].startsWith('SUCCESS:') ? '#2e7d32' : '#c62828'
                      }}>
                        {errors[crypto.id].replace('SUCCESS:', '')}
                      </div>
                    )}

                    {/* Address Input */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: '#333'
                      }}>
                        {crypto.symbol} Receiving Address
                      </label>
                      <input
                        type="text"
                        placeholder={`Enter your ${crypto.symbol} address`}
                        value={formData[crypto.id]?.address || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          [crypto.id]: { ...prev[crypto.id], address: e.target.value }
                        }))}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid #ccc',
                          borderRadius: '6px',
                          fontSize: '0.9rem',
                          fontFamily: 'monospace'
                        }}
                      />
                    </div>

                    {/* OTP Section */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{
                        display: 'block',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        color: '#333'
                      }}>
                        Verification Code
                      </label>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <input
                          type="text"
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          value={formData[crypto.id]?.otp || ''}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            [crypto.id]: { ...prev[crypto.id], otp: e.target.value.replace(/\D/g, '') }
                          }))}
                          style={{
                            flex: 1,
                            padding: '0.75rem',
                            border: '1px solid #ccc',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            letterSpacing: '0.2rem',
                            textAlign: 'center'
                          }}
                        />
                        <button
                          onClick={() => handleGetCode(crypto.id)}
                          disabled={loadingStates[`${crypto.id}_otp`] || (otpCooldowns[crypto.id] || 0) > 0}
                          style={{
                            padding: '0.75rem 1.5rem',
                            backgroundColor: (otpCooldowns[crypto.id] || 0) > 0 ? '#666' : '#000',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: (loadingStates[`${crypto.id}_otp`] || (otpCooldowns[crypto.id] || 0) > 0) ? 'not-allowed' : 'pointer',
                            opacity: (loadingStates[`${crypto.id}_otp`] || (otpCooldowns[crypto.id] || 0) > 0) ? 0.6 : 1,
                            transition: 'background-color 0.2s',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {loadingStates[`${crypto.id}_otp`] 
                            ? 'Sending...' 
                            : (otpCooldowns[crypto.id] || 0) > 0 
                              ? `Resend (${otpCooldowns[crypto.id]}s)` 
                              : otpSent[crypto.id] 
                                ? 'Resend' 
                                : 'Get Code'}
                        </button>
                      </div>
                      {otpSent[crypto.id] && (
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#666',
                          marginTop: '0.5rem'
                        }}>
                          Code expires in 5 minutes. Check your email at {user?.email}
                        </div>
                      )}
                    </div>

                    {/* Save Button */}
                    <button
                      onClick={() => handleSave(crypto.id)}
                      disabled={loadingStates[`${crypto.id}_save`]}
                      style={{
                        width: '100%',
                        padding: '0.875rem',
                        backgroundColor: '#000',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        cursor: loadingStates[`${crypto.id}_save`] ? 'not-allowed' : 'pointer',
                        opacity: loadingStates[`${crypto.id}_save`] ? 0.6 : 1,
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => !loadingStates[`${crypto.id}_save`] && (e.currentTarget.style.backgroundColor = '#333')}
                      onMouseOut={(e) => !loadingStates[`${crypto.id}_save`] && (e.currentTarget.style.backgroundColor = '#000')}
                    >
                      {loadingStates[`${crypto.id}_save`] ? 'Saving...' : 'Save Configuration'}
                    </button>
                  </div>
                )}
              </div>
            ))}
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
