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
}

interface CryptoConfig {
  coin: string;
  address: string;
  enabled: boolean;
  created_at: string;
}

export default function InvoicesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [discordUsername, setDiscordUsername] = useState<string | null>(null);
  const [discordClientId, setDiscordClientId] = useState<string>('');
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cryptoConfigs, setCryptoConfigs] = useState<{[key: string]: CryptoConfig}>({});
  const [selectedCoin, setSelectedCoin] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter invoices based on search query
  const filteredInvoices = invoices.filter(invoice => {
    const query = searchQuery.toLowerCase();
    return (
      invoice.invoice_id.toLowerCase().includes(query) ||
      (invoice.description && invoice.description.toLowerCase().includes(query))
    );
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

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
      fetchInvoices();
      fetchCryptoConfigs();
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

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto/invoices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired - logout and redirect to home
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        router.push('/');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCryptoConfigs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto/config`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired - logout and redirect to home
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        router.push('/');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.configs) {
          setCryptoConfigs(data.configs);
          // Set first configured coin as default
          const coins = Object.keys(data.configs);
          if (coins.length > 0) {
            setSelectedCoin(coins[0]);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching crypto configs:', error);
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);

    try {
      const token = localStorage.getItem('token');
      
      if (!cryptoConfigs[selectedCoin]) {
        setError('Please configure crypto payments first');
        setCreating(false);
        return;
      }

      const response = await fetch(`${API_URL}/api/crypto/invoice/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          coin: selectedCoin,
          amount_crypto: parseFloat(amount),
          description: description || 'Invoice payment'
        })
      });

      if (response.status === 401) {
        // Token expired - logout and redirect to home
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        router.push('/');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setShowCreateModal(false);
        setAmount('');
        setDescription('');
        
        // Open invoice link in new tab
        window.open(`/invoice/${data.invoice_id}`, '_blank');
        
        // Refresh invoices list
        fetchInvoices();
      } else {
        const data = await response.json();
        setError(data.detail || 'Failed to create invoice');
      }
    } catch (error) {
      setError('Error creating invoice');
      console.error('Error:', error);
    } finally {
      setCreating(false);
    }
  };

  const [showRevokeModal, setShowRevokeModal] = useState(false);
  const [revokeInvoiceId, setRevokeInvoiceId] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const copyInvoiceLink = (invoiceId: string) => {
    const link = `${window.location.origin}/invoice/${invoiceId}`;
    navigator.clipboard.writeText(link);
    setToastMessage('Invoice link copied to clipboard!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const openRevokeModal = (invoiceId: string) => {
    setRevokeInvoiceId(invoiceId);
    setShowRevokeModal(true);
  };

  const closeRevokeModal = () => {
    setShowRevokeModal(false);
    setRevokeInvoiceId(null);
  };

  const revokeInvoice = async () => {
    if (!revokeInvoiceId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/crypto/invoice/${revokeInvoiceId}/revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired - logout and redirect to home
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
        closeRevokeModal();
        fetchInvoices(); // Refresh list
      } else {
        const data = await response.json();
        alert(data.detail || 'Failed to revoke invoice');
      }
    } catch (error) {
      console.error('Error revoking invoice:', error);
      alert('Error revoking invoice');
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date().getTime();
    const expires = new Date(expiresAt).getTime();
    const diff = expires - now;

    if (diff <= 0) {
      return 'Expired';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    }
    return `${minutes}m remaining`;
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

  const configuredCoins = Object.keys(cryptoConfigs);

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

      {/* Invoices Content */}
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
            <img src="/invoice-svgrepo-com.svg" alt="" style={{ width: '29px', height: '29px' }} />
            Invoices
          </h2>
          
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={configuredCoins.length === 0}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: configuredCoins.length === 0 ? '#ccc' : '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: configuredCoins.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => configuredCoins.length > 0 && (e.currentTarget.style.backgroundColor = '#333')}
            onMouseOut={(e) => configuredCoins.length > 0 && (e.currentTarget.style.backgroundColor = '#000')}
          >
            + Create Invoice
          </button>
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
              placeholder="Search by Invoice ID or description..."
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
              Found {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {configuredCoins.length === 0 && (
          <div style={{ 
            padding: '1rem 1.5rem', 
            backgroundColor: '#fff3cd', 
            borderRadius: '8px', 
            marginBottom: '1.5rem',
            border: '1px solid #ffc107'
          }}>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Please configure crypto payments first. Go to <Link href="/dashboard/payments" style={{ color: '#000', fontWeight: '600', textDecoration: 'underline' }}>Payments</Link> to set up.
            </p>
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
            <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '1rem' }}>Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem 2rem',
            backgroundColor: '#f9f9f9',
            borderRadius: '8px'
          }}>
            <img src="/invoice-svgrepo-com.svg" alt="" style={{ width: '48px', height: '48px', opacity: 0.3, marginBottom: '1rem' }} />
            <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0' }}>No invoices yet</p>
            {configuredCoins.length > 0 && (
              <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>Create your first invoice to get started</p>
            )}
          </div>
        ) : filteredInvoices.length === 0 ? (
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
            <p style={{ fontSize: '1rem', color: '#666', margin: '0.5rem 0' }}>No invoices match your search</p>
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
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>ID</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Description</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Price</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Paid</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Payment Method</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Created At</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>Completed At</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}></th>
                </tr>
              </thead>
              <tbody>
                {paginatedInvoices.map((invoice) => {
                  const expired = invoice.expires_at && isExpired(invoice.expires_at);
                  const isPending = invoice.status === 'pending';
                  const finalStatus = expired && isPending ? 'expired' : invoice.status;
                  
                  return (
                    <tr 
                      key={invoice.invoice_id}
                      onClick={() => router.push(`/dashboard/invoices/${invoice.invoice_id}`)}
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
                            finalStatus === 'paid' || finalStatus === 'confirmed' ? 'rgba(34, 197, 94, 0.1)' :
                            finalStatus === 'pending' ? 'rgba(59, 130, 246, 0.1)' :
                            finalStatus === 'expired' ? 'rgba(251, 146, 60, 0.1)' :
                            finalStatus === 'revoked' ? 'rgba(239, 68, 68, 0.1)' : '#e0e0e0'
                          }`
                        }}>
                          {finalStatus}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        {invoice.invoice_id}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {invoice.description || '-'}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        ${parseFloat(invoice.amount_usd).toFixed(2)}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {invoice.paid_at ? (
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '8px',
                            fontSize: '0.75rem',
                            textTransform: 'capitalize',
                            backgroundColor: 'rgba(34, 197, 94, 0.2)',
                            color: 'rgb(34, 197, 94)',
                            border: '1px solid rgba(34, 197, 94, 0.1)'
                          }}>
                            +${parseFloat(invoice.amount_usd).toFixed(2)}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.875rem', color: '#999' }}>-</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <img 
                            src={getCryptoIcon(invoice.coin)} 
                            alt={invoice.coin}
                            style={{ width: '1.125rem', height: '1.125rem' }}
                          />
                          <span style={{ fontSize: '0.875rem', color: '#000', textTransform: 'capitalize' }}>
                            {invoice.coin === 'btc' ? 'Bitcoin' : 
                             invoice.coin === 'eth' ? 'Ethereum' : 
                             invoice.coin === 'ltc' ? 'Litecoin' : 
                             invoice.coin === 'sol' ? 'Solana' : invoice.coin}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        {new Date(invoice.created_at).toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#000' }}>
                        {invoice.paid_at ? new Date(invoice.paid_at).toLocaleString() : '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'nowrap' }}>
                          {!expired && (
                            <button
                              onClick={() => window.open(`/invoice/${invoice.invoice_id}`, '_blank')}
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
                              View Invoice
                            </button>
                          )}
                          <button
                            onClick={() => copyInvoiceLink(invoice.invoice_id)}
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
                            Copy Link
                          </button>
                          {isPending && !expired && (
                            <button
                              onClick={() => openRevokeModal(invoice.invoice_id)}
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
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredInvoices.length)} of {filteredInvoices.length}
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
      </div>
    </main>

      {/* Create Invoice Modal */}
      {showCreateModal && (
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
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              backgroundColor: '#fff',
              padding: '2rem',
              borderRadius: '12px',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: '700' }}>Create Invoice</h2>
            
            <form onSubmit={handleCreateInvoice}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                  Cryptocurrency
                </label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    fontSize: '1rem',
                    backgroundColor: '#fff'
                  }}
                >
                  {configuredCoins.map((coin) => (
                    <option key={coin} value={coin}>
                      {coin.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                  Amount ({selectedCoin.toUpperCase()})
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.001"
                  required
                  min="0"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', fontSize: '0.9rem' }}>
                  Description
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Payment for services"
                  maxLength={200}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #e0e0e0',
                    fontSize: '1rem'
                  }}
                />
              </div>

              {/* Expiration Notice */}
              <div style={{
                padding: '1rem',
                backgroundColor: '#e3f2fd',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                border: '1px solid #2196f3'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>⏰</span>
                  <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#1976d2' }}>
                    Invoice Expiration Policy
                  </p>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#1565c0', lineHeight: '1.5' }}>
                  All invoices automatically expire after <strong>12 hours</strong>. Customers must complete payment within this timeframe or the invoice will no longer be valid.
                </p>
              </div>

              {error && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: '#ffebee',
                  color: '#c62828',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                  fontSize: '0.9rem'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#f5f5f5',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: creating ? '#ccc' : '#000',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: creating ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => !creating && (e.currentTarget.style.backgroundColor = '#333')}
                  onMouseOut={(e) => !creating && (e.currentTarget.style.backgroundColor = '#000')}
                >
                  {creating ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
          onClick={closeRevokeModal}
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
                onClick={closeRevokeModal}
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
