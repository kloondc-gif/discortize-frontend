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

interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
}

interface Subscription {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_days: number;
  role_id: string;
  active: boolean;
  created_at: string;
}

export default function ManageServerPage() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.serverId as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [guild, setGuild] = useState<DiscordGuild | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    duration_days: '30',
    role_id: ''
  });

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
      
      fetchGuildDetails(token);
      fetchSubscriptions(token);
    } catch (error) {
      console.error('Error parsing user data:', error);
      router.push('/login');
      return;
    }

    return () => {
      stopTokenRefresh();
    };
  }, [router, serverId]);

  const fetchGuildDetails = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/guilds/${serverId}`, {
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
        setGuild(data);
        
        // Register server with current user as owner
        await registerServer(token, data);
      }
    } catch (error) {
      console.error('Error fetching guild details:', error);
    }
  };

  const registerServer = async (token: string, guildData: any) => {
    try {
      const response = await fetch(`${API_URL}/api/discord/servers/${serverId}/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: guildData.name,
          icon: guildData.icon
        })
      });
      
      if (response.ok) {
        console.log('Server registered successfully');
      } else {
        const error = await response.text();
        console.error('Failed to register server:', error);
      }
    } catch (error) {
      console.error('Error registering server:', error);
    }
  };

  const fetchSubscriptions = async (token: string) => {
    setLoadingSubscriptions(true);
    try {
      const response = await fetch(`${API_URL}/api/discord/subscriptions/${serverId}`, {
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
        setSubscriptions(Array.isArray(data) ? data : (data.subscriptions || []));
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/discord/subscriptions/${serverId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          duration: `${formData.duration_days} days`,
          duration_days: parseInt(formData.duration_days),
          role_id: formData.role_id,
          payment_methods: ['ltc', 'sol', 'btc', 'eth'],
          enabled: true
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      if (response.ok) {
        alert('Subscription added successfully!');
        setShowAddForm(false);
        setFormData({
          name: '',
          description: '',
          price: '',
          duration_days: '30',
          role_id: ''
        });
        fetchSubscriptions(token);
      } else {
        const error = await response.json();
        alert(`Failed to add subscription: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error adding subscription:', error);
      alert('An error occurred while adding the subscription');
    }
  };

  const toggleSubscriptionStatus = async (subscriptionId: string, currentStatus: boolean) => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/discord/subscriptions/${serverId}/${subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          enabled: !currentStatus
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      if (response.ok) {
        fetchSubscriptions(token);
      } else {
        alert('Failed to update subscription status');
      }
    } catch (error) {
      console.error('Error toggling subscription status:', error);
      alert('An error occurred while updating the subscription status');
    }
  };

  const handleEditClick = (subscription: Subscription) => {
    if (editingId === subscription.id) {
      // If clicking edit on already editing subscription, cancel edit
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        duration_days: '30',
        role_id: ''
      });
    } else {
      // Start editing this subscription
      setEditingId(subscription.id);
      setFormData({
        name: subscription.name,
        description: subscription.description || '',
        price: subscription.price.toString(),
        duration_days: subscription.duration_days.toString(),
        role_id: subscription.role_id
      });
    }
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token || !editingId) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/discord/subscriptions/${serverId}/${editingId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          duration: `${formData.duration_days} days`,
          duration_days: parseInt(formData.duration_days),
          role_id: formData.role_id
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      if (response.ok) {
        alert('Subscription updated successfully!');
        setShowAddForm(false);
        setEditingId(null);
        setFormData({
          name: '',
          description: '',
          price: '',
          duration_days: '30',
          role_id: ''
        });
        fetchSubscriptions(token);
      } else {
        const error = await response.json();
        alert(`Failed to update subscription: ${error.detail || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating subscription:', error);
      alert('An error occurred while updating the subscription');
    }
  };

  const handleLogout = () => {
    stopTokenRefresh();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refresh_token');
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
          <button
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '24px',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'default',
              marginBottom: '1rem',
              transition: 'background-color 0.2s',
              textDecoration: 'none',
              display: 'block',
              textAlign: 'center'
            }}
          >
            {user.username}
          </button>

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
              backgroundColor: 'transparent'
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
              transition: 'background-color 0.2s',
              backgroundColor: '#f5f5f5'
            }}
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
              backgroundColor: 'transparent'
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

        {/* Server Management Content */}
        <div style={{
          flex: 1,
          paddingLeft: '5rem',
          maxWidth: '900px'
        }}>
          {/* Back button and server header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link
              href="/dashboard/servers"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#666',
                textDecoration: 'none',
                fontSize: '0.9rem',
                marginBottom: '1rem'
              }}
            >
              ← Back to Servers
            </Link>
            
            {guild && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}>
                {guild.icon ? (
                  <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt={guild.name}
                    style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: '#5865F2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontWeight: '600',
                    fontSize: '1.5rem'
                  }}>
                    {guild.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2 style={{ 
                    fontSize: '1.8rem', 
                    fontWeight: '700',
                    marginBottom: '0.25rem',
                    color: '#000'
                  }}>
                    {guild.name}
                  </h2>
                  <p style={{ color: '#666', fontSize: '0.9rem' }}>
                    Server ID: {guild.id}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Subscriptions Section */}
          <div style={{ marginTop: '2rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{
                fontSize: '1.4rem',
                fontWeight: '700',
                color: '#000'
              }}>
                Subscriptions
              </h3>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  if (showAddForm) {
                    setEditingId(null);
                    setFormData({
                      name: '',
                      description: '',
                      price: '',
                      duration_days: '30',
                      role_id: ''
                    });
                  }
                }}
                style={{
                  padding: '0.5rem 1.25rem',
                  backgroundColor: '#000',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
              >
                {showAddForm ? 'Cancel' : '+ Add Subscription'}
              </button>
            </div>

            {/* Add/Edit Subscription Form */}
            {showAddForm && (
              <form
                onSubmit={editingId ? handleUpdateSubscription : handleAddSubscription}
                style={{
                  padding: '1.5rem',
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  marginBottom: '1.5rem'
                }}
              >
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>
                    Subscription Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Premium Member"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    placeholder="Describe what this subscription includes"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '0.95rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1rem',
                  marginBottom: '1rem'
                }}>
                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}>
                      Price (USD) *
                    </label>
                    <input
                      type="number"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="9.99"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      marginBottom: '0.5rem',
                      fontWeight: '600',
                      fontSize: '0.9rem'
                    }}>
                      Duration (days) *
                    </label>
                    <input
                      type="number"
                      name="duration_days"
                      value={formData.duration_days}
                      onChange={handleInputChange}
                      required
                      min="1"
                      placeholder="30"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '0.95rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    fontWeight: '600',
                    fontSize: '0.9rem'
                  }}>
                    Discord Role ID *
                  </label>
                  <input
                    type="text"
                    name="role_id"
                    value={formData.role_id}
                    onChange={handleInputChange}
                    required
                    placeholder="123456789012345678"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      fontSize: '0.95rem'
                    }}
                  />
                  <small style={{ color: '#666', fontSize: '0.85rem' }}>
                    The Discord role that will be assigned to subscribers
                  </small>
                </div>

                <button
                  type="submit"
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
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
                >
                  {editingId ? 'Update Subscription' : 'Create Subscription'}
                </button>
              </form>
            )}

            {/* Subscriptions List */}
            {loadingSubscriptions ? (
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
                <style jsx>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : subscriptions.length === 0 ? (
              <div style={{
                padding: '2rem',
                backgroundColor: '#f9f9f9',
                borderRadius: '8px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#666' }}>No subscriptions created yet</p>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                {subscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '0.75rem'
                    }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          marginBottom: '0.5rem',
                          color: '#000'
                        }}>
                          {subscription.name}
                        </h4>
                        {subscription.description && (
                          <p style={{
                            color: '#666',
                            fontSize: '0.9rem',
                            marginBottom: '0.75rem'
                          }}>
                            {subscription.description}
                          </p>
                        )}
                        <div style={{
                          display: 'flex',
                          gap: '1.5rem',
                          fontSize: '0.9rem',
                          color: '#666'
                        }}>
                          <span><strong>Price:</strong> ${subscription.price.toFixed(2)}</span>
                          <span><strong>Duration:</strong> {subscription.duration_days} days</span>
                          <span><strong>Role ID:</strong> {subscription.role_id}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
                        <button
                          onClick={() => handleEditClick(subscription)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: editingId === subscription.id ? '#f5f5f5' : '#fff',
                            color: '#000',
                            border: '1px solid #e0e0e0',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = editingId === subscription.id ? '#f5f5f5' : '#fff'}
                        >
                          {editingId === subscription.id ? 'Cancel' : 'Edit'}
                        </button>
                        <button
                          onClick={() => toggleSubscriptionStatus(subscription.id, subscription.active)}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: subscription.active ? '#000' : '#666',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          {subscription.active ? 'Active' : 'Inactive'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Inline Edit Form */}
                    {editingId === subscription.id && (
                      <form
                        onSubmit={handleUpdateSubscription}
                        style={{
                          marginTop: '1rem',
                          paddingTop: '1rem',
                          borderTop: '1px solid #e0e0e0'
                        }}
                      >
                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            Subscription Name *
                          </label>
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            required
                            placeholder="e.g., Premium Member"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: '0.95rem'
                            }}
                          />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            Description
                          </label>
                          <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleInputChange}
                            placeholder="Optional description"
                            rows={3}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: '0.95rem',
                              fontFamily: 'inherit',
                              resize: 'vertical'
                            }}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '0.5rem',
                              fontWeight: '600',
                              fontSize: '0.9rem'
                            }}>
                              Price (USD) *
                            </label>
                            <input
                              type="number"
                              name="price"
                              value={formData.price}
                              onChange={handleInputChange}
                              required
                              min="0"
                              step="0.01"
                              placeholder="10.00"
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '0.95rem'
                              }}
                            />
                          </div>

                          <div>
                            <label style={{
                              display: 'block',
                              marginBottom: '0.5rem',
                              fontWeight: '600',
                              fontSize: '0.9rem'
                            }}>
                              Duration (days) *
                            </label>
                            <input
                              type="number"
                              name="duration_days"
                              value={formData.duration_days}
                              onChange={handleInputChange}
                              required
                              min="1"
                              placeholder="30"
                              style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #ddd',
                                borderRadius: '6px',
                                fontSize: '0.95rem'
                              }}
                            />
                          </div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: '600',
                            fontSize: '0.9rem'
                          }}>
                            Discord Role ID *
                          </label>
                          <input
                            type="text"
                            name="role_id"
                            value={formData.role_id}
                            onChange={handleInputChange}
                            required
                            placeholder="123456789012345678"
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #ddd',
                              borderRadius: '6px',
                              fontSize: '0.95rem'
                            }}
                          />
                          <small style={{ color: '#666', fontSize: '0.85rem' }}>
                            The Discord role that will be assigned to subscribers
                          </small>
                        </div>

                        <button
                          type="submit"
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
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#333'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#000'}
                        >
                          Update Subscription
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
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
              <a href="https://discord.gg/H2yNQfpU" target="_blank" rel="noopener noreferrer" className="social-link" title="Join our Discord">💬</a>
              <a href="#" className="social-link">𝕏</a>
              <a href="#" className="social-link">▶</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
