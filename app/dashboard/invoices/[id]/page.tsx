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

interface Invoice {
  invoice_id: string;
  coin: string;
  amount: string;
  amount_usd: string;
  address: string;
  status: string;
  description: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
  transaction_id?: string;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [showRevokeModal, setShowRevokeModal] = useState(false);
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
      fetchInvoice();
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router, invoiceId]);

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

  const fetchInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto/invoices`, {
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
        const foundInvoice = data.invoices?.find((inv: Invoice) => inv.invoice_id === invoiceId);
        if (foundInvoice) {
          setInvoice(foundInvoice);
        } else {
          router.push('/dashboard/invoices');
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyInvoiceLink = () => {
    const link = `${window.location.origin}/invoice/${invoiceId}`;
    navigator.clipboard.writeText(link);
    setToastMessage('Invoice link copied to clipboard!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const revokeInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto/invoice/${invoiceId}/revoke`, {
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
        setToastMessage('Invoice revoked successfully');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
        setShowRevokeModal(false);
        fetchInvoice();
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to revoke invoice');
      }
    } catch (error) {
      console.error('Error revoking invoice:', error);
      alert('Error revoking invoice');
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt).getTime() < new Date().getTime();
  };

  const getCryptoIcon = (coin: string) => {
    const icons: { [key: string]: string } = {
      'sol': '/solana-sol-logo.svg',
      'ltc': '/litecoin-ltc-logo.svg',
      'btc': '/bitcoin-btc-logo.svg',
      'eth': '/ethereum-eth-logo.svg'
    };
    return icons[coin.toLowerCase()] || '/buy-crypto-svgrepo-com.svg';
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    router.push('/');
  };

  const expired = invoice?.expires_at && isExpired(invoice.expires_at);
  const isPending = invoice?.status === 'pending';
  const finalStatus = expired && isPending ? 'expired' : invoice?.status;

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
              transition: 'background-color 0.2s',
              backgroundColor: '#f5f5f5'
            }}
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

        {/* Invoice Detail Content */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '1400px',
          width: '100%'
        }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <Link 
              href="/dashboard/invoices"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#666',
                textDecoration: 'none',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '1rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.color = '#000'}
              onMouseOut={(e) => e.currentTarget.style.color = '#666'}
            >
              ← Back to Invoices
            </Link>
            <h2 style={{ 
              fontSize: '1.575rem', 
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: '#000',
              margin: 0
            }}>
              <img src="/invoice-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
              Invoice Details
            </h2>
          </div>

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
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>Loading invoice...</p>
            </div>
          ) : !invoice ? (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem 2rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '8px'
            }}>
              <p style={{ fontSize: '1rem', color: '#666' }}>Invoice not found</p>
            </div>
          ) : (
            <>
              {/* Status Badge */}
              <div style={{ marginBottom: '2rem' }}>
                <span style={{
                  display: 'inline-block',
                  padding: '0.5rem 1.25rem',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  textTransform: 'capitalize',
                  fontWeight: '600',
                  backgroundColor: 
                    finalStatus === 'paid' || finalStatus === 'confirmed' ? 'rgba(34, 197, 94, 0.2)' :
                    finalStatus === 'pending' ? 'rgba(59, 130, 246, 0.2)' :
                    finalStatus === 'expired' ? 'rgba(251, 146, 60, 0.2)' :
                    finalStatus === 'revoked' ? 'rgba(239, 68, 68, 0.2)' : '#f0f0f0',
                  color:
                    finalStatus === 'paid' || finalStatus === 'confirmed' ? 'rgb(34, 197, 94)' :
                    finalStatus === 'pending' ? 'rgb(59, 130, 246)' :
                    finalStatus === 'expired' ? 'rgb(251, 146, 60)' :
                    finalStatus === 'revoked' ? 'rgb(239, 68, 68)' : '#666',
                  border: `1px solid ${
                    finalStatus === 'paid' || finalStatus === 'confirmed' ? 'rgba(34, 197, 94, 0.3)' :
                    finalStatus === 'pending' ? 'rgba(59, 130, 246, 0.3)' :
                    finalStatus === 'expired' ? 'rgba(251, 146, 60, 0.3)' :
                    finalStatus === 'revoked' ? 'rgba(239, 68, 68, 0.3)' : '#e0e0e0'
                  }`
                }}>
                  {finalStatus}
                </span>
              </div>

              {/* Main Info Card */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                overflow: 'hidden',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '1.25rem 1.5rem',
                  backgroundColor: '#1a1a1a',
                  borderBottom: '1px solid #e0e0e0'
                }}>
                  <div style={{
                    backgroundColor: '#000',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    padding: '0.5rem',
                    color: '#fff'
                  }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                      <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM40,112H80v32H40Zm56,0H216v32H96ZM216,64V96H40V64ZM40,192V160H80v32Zm176,0H96V160H216v32Z"></path>
                    </svg>
                  </div>
                  <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', margin: 0 }}>
                    Invoice Details
                  </h3>
                </div>

                <div style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Invoice ID</h3>
                    <p style={{ fontSize: '1rem', fontWeight: '500', color: '#000', margin: 0, wordBreak: 'break-all' }}>{invoice.invoice_id}</p>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Amount</h3>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#000', margin: 0 }}>
                      ${parseFloat(invoice.amount_usd).toFixed(2)}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: '#666', margin: '0.25rem 0 0 0' }}>
                      {parseFloat(invoice.amount).toFixed(8)} {invoice.coin.toUpperCase()}
                    </p>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Method</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <img 
                        src={getCryptoIcon(invoice.coin)} 
                        alt={invoice.coin}
                        style={{ width: '1.5rem', height: '1.5rem' }}
                      />
                      <span style={{ fontSize: '1rem', color: '#000', fontWeight: '500', textTransform: 'capitalize' }}>
                        {invoice.coin === 'btc' ? 'Bitcoin' : 
                         invoice.coin === 'eth' ? 'Ethereum' : 
                         invoice.coin === 'ltc' ? 'Litecoin' : 
                         invoice.coin === 'sol' ? 'Solana' : invoice.coin}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created At</h3>
                    <p style={{ fontSize: '1rem', color: '#000', margin: 0 }}>
                      {new Date(invoice.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>

                  {invoice.paid_at && (
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Paid At</h3>
                      <p style={{ fontSize: '1rem', color: '#000', margin: 0 }}>
                        {new Date(invoice.paid_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}

                  {invoice.expires_at && (
                    <div>
                      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Expires At</h3>
                      <p style={{ fontSize: '1rem', color: expired ? '#ef4444' : '#000', margin: 0 }}>
                        {new Date(invoice.expires_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {invoice.description && (
                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Description</h3>
                    <p style={{ fontSize: '1rem', color: '#000', margin: 0, lineHeight: '1.6' }}>
                      {invoice.description}
                    </p>
                  </div>
                )}

                {invoice.address && (
                  <div style={{ marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid #e0e0e0' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payment Address</h3>
                    <p style={{ 
                      fontSize: '0.9rem', 
                      color: '#000', 
                      margin: 0, 
                      fontFamily: 'monospace',
                      backgroundColor: '#f9f9f9',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      wordBreak: 'break-all'
                    }}>
                      {invoice.address}
                    </p>
                  </div>
                )}
              </div>
              </div>

              {/* Actions */}
              <div style={{
                backgroundColor: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: '12px',
                padding: '1.5rem',
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap',
                marginBottom: '1.5rem'
              }}>
                {!expired && finalStatus === 'pending' && (
                  <button
                    onClick={() => window.open(`/invoice/${invoiceId}`, '_blank')}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
                  >
                    View Payment Page
                  </button>
                )}

                <button
                  onClick={copyInvoiceLink}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#f5f5f5',
                    color: '#000',
                    border: '1px solid #e0e0e0',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                >
                  Copy Invoice Link
                </button>

                {isPending && !expired && (
                  <button
                    onClick={() => setShowRevokeModal(true)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#fff',
                      color: '#ef4444',
                      border: '1px solid #ef4444',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginLeft: 'auto'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = '#fff';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    Revoke Invoice
                  </button>
                )}
              </div>

              {/* Payment History */}
              {(finalStatus === 'paid' || finalStatus === 'confirmed') && invoice.paid_at && (
                <div style={{
                  backgroundColor: '#fff',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '1.25rem 1.5rem',
                    backgroundColor: '#1a1a1a',
                    borderBottom: '1px solid #e0e0e0'
                  }}>
                    <div style={{
                      backgroundColor: '#000',
                      border: '1px solid #333',
                      borderRadius: '8px',
                      padding: '0.5rem',
                      color: '#fff'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                        <path d="M207.58,63.84C186.85,53.48,159.33,48,128,48S69.15,53.48,48.42,63.84,16,88.78,16,104v48c0,15.22,11.82,29.85,32.42,40.16S96.67,208,128,208s58.85-5.48,79.58-15.84S240,167.22,240,152V104C240,88.78,228.18,74.15,207.58,63.84ZM128,64c62.64,0,96,23.23,96,40s-33.36,40-96,40-96-23.23-96-40S65.36,64,128,64Zm-8,95.86v32c-19-.62-35-3.42-48-7.49V153.05A203.43,203.43,0,0,0,120,159.86Zm16,0a203.43,203.43,0,0,0,48-6.81v31.31c-13,4.07-29,6.87-48,7.49ZM32,152V133.53a82.88,82.88,0,0,0,16.42,10.63c2.43,1.21,5,2.35,7.58,3.43V178C40.17,170.16,32,160.29,32,152Zm168,26V147.59c2.61-1.08,5.15-2.22,7.58-3.43A82.88,82.88,0,0,0,224,133.53V152C224,160.29,215.83,170.16,200,178Z"></path>
                      </svg>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', margin: 0 }}>
                      Payment History
                    </h3>
                  </div>

                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9f9f9' }}>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.875rem', color: '#000', fontWeight: '600' }}>Status</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.875rem', color: '#000', fontWeight: '600' }}>Amount</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.875rem', color: '#000', fontWeight: '600' }}>Paid At</th>
                        <th style={{ padding: '1rem 1.5rem', textAlign: 'left', fontSize: '0.875rem', color: '#000', fontWeight: '600' }}>Transaction ID</th>
                      </tr>
                    </thead>
                    <tbody style={{ borderTop: '1px solid #e0e0e0' }}>
                      <tr>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.375rem 0.875rem',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            textTransform: 'capitalize',
                            fontWeight: '500',
                            backgroundColor: 'rgba(34, 197, 94, 0.2)',
                            color: 'rgb(34, 197, 94)',
                            border: '1px solid rgba(34, 197, 94, 0.2)'
                          }}>
                            Completed
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div>
                            <div style={{ fontSize: '0.875rem', color: '#000', fontWeight: '500' }}>
                              {parseFloat(invoice.amount).toFixed(8)} {invoice.coin.toUpperCase()}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                              100% of {parseFloat(invoice.amount).toFixed(8)} {invoice.coin.toUpperCase()}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: '#000' }}>
                          {new Date(invoice.paid_at).toLocaleString('en-US', {
                            month: 'numeric',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          {invoice.transaction_id ? (
                            <a
                              href={
                                invoice.coin.toLowerCase() === 'btc' ? `https://blockchair.com/bitcoin/transaction/${invoice.transaction_id}` :
                                invoice.coin.toLowerCase() === 'ltc' ? `https://live.blockcypher.com/ltc/tx/${invoice.transaction_id}` :
                                invoice.coin.toLowerCase() === 'eth' ? `https://etherscan.io/tx/${invoice.transaction_id}` :
                                invoice.coin.toLowerCase() === 'sol' ? `https://solscan.io/tx/${invoice.transaction_id}` :
                                '#'
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: '0.875rem',
                                color: '#3b82f6',
                                textDecoration: 'none',
                                wordBreak: 'break-all'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                            >
                              {invoice.transaction_id}
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.875rem', color: '#666' }}>-</span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Revoke Modal */}
      {showRevokeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowRevokeModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '450px',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.5rem', fontWeight: '700', color: '#000' }}>
              Revoke Invoice
            </h2>
            <p style={{ margin: '0 0 2rem 0', fontSize: '1rem', color: '#666', lineHeight: '1.5' }}>
              Are you sure you want to revoke this invoice? This action cannot be undone and the invoice will no longer be valid for payment.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowRevokeModal(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#f5f5f5',
                  color: '#000',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
              >
                Cancel
              </button>
              <button
                onClick={revokeInvoice}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Revoke Invoice
              </button>
            </div>
          </div>
        </div>
      )}

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
