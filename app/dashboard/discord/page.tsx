'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { API_URL } from '@/lib/api';

interface DiscordUser {
  id: string;
  username: string;
  discriminator?: string;
  avatar?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
  icon?: string;
  owner: boolean;
  permissions: string;
  bot_in_server: boolean;
}

interface GuildSettings {
  guild_id: string;
  notification_channel_id?: string;
  enabled: boolean;
}

function DiscordConnectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [discordUser, setDiscordUser] = useState<DiscordUser | null>(null);
  const [guilds, setGuilds] = useState<DiscordGuild[]>([]);
  const [selectedGuild, setSelectedGuild] = useState<string | null>(null);
  const [guildSettings, setGuildSettings] = useState<Record<string, GuildSettings>>({});
  const [discordClientId, setDiscordClientId] = useState<string>('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    // Fetch Discord Client ID
    fetchClientId();

    // Handle OAuth callback
    const code = searchParams.get('code');
    if (code) {
      handleCallback(code);
    } else {
      checkConnection();
    }
  }, [searchParams]);

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

  const checkConnection = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/discord/connection`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refresh_token');
        router.push('/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setConnected(data.connected);
        if (data.connected) {
          setDiscordUser(data.discord_user);
          await fetchGuilds();
        }
      }
    } catch (error) {
      console.error('Error checking Discord connection:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCallback = async (code: string) => {
    try {
      const token = localStorage.getItem('token');
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
        setConnected(true);
        setDiscordUser(data.discord_user);
        // Remove code from URL
        window.history.replaceState({}, '', '/dashboard/discord');
        await fetchGuilds();
      } else {
        console.error('Failed to connect Discord account');
      }
    } catch (error) {
      console.error('Error handling Discord callback:', error);
    } finally {
      setLoading(false);
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
        // Token expired or invalid
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

  const disconnectDiscord = async () => {
    if (!confirm('Are you sure you want to disconnect your Discord account?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/disconnect`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setConnected(false);
        setDiscordUser(null);
        setGuilds([]);
      }
    } catch (error) {
      console.error('Error disconnecting Discord:', error);
    }
  };

  const fetchGuilds = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/discord/guilds`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGuilds(data);
        // Don't fetch all settings upfront - fetch only when needed
      }
    } catch (error) {
      console.error('Error fetching guilds:', error);
    }
  };

  const fetchGuildSettings = async (guildId: string) => {
    // Skip if already fetched
    if (guildSettings[guildId]) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/discord/guild/${guildId}/settings`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setGuildSettings(prev => ({
          ...prev,
          [guildId]: data
        }));
      }
    } catch (error) {
      console.error('Error fetching guild settings:', error);
    }
  };

  const updateGuildSettings = async (guildId: string, settings: Partial<GuildSettings>) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_URL}/api/discord/guild/${guildId}/settings`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(settings)
        }
      );

      if (response.ok) {
        await fetchGuildSettings(guildId);
      }
    } catch (error) {
      console.error('Error updating guild settings:', error);
    }
  };

  const getAvatarUrl = (userId: string, avatar?: string) => {
    if (!avatar) return '/default-avatar.png';
    return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
  };

  const getGuildIconUrl = (guildId: string, icon?: string) => {
    if (!icon) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png`;
  };

  const getGuildInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getBotInviteUrl = (guildId: string) => {
    if (!discordClientId) return '#';
    return `https://discord.com/api/oauth2/authorize?client_id=${discordClientId}&permissions=2048&scope=bot&guild_id=${guildId}`;
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
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>
      {/* Header */}
      <header className="header">
        <div className="container">
          <nav className="nav">
            <a href="/" className="logo">
              <img src="/discortize-logo.png" alt="Discortize" className="logo-img" />
            </a>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Link href="/dashboard" className="nav-login">
                ← Dashboard
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2rem' }}>
        {/* Page Header */}
        <div style={{ marginBottom: '3rem' }}>
          <h1 style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            marginBottom: '0.5rem',
            letterSpacing: '-0.02em',
            color: '#000'
          }}>
            Discord Integration
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#666',
            fontWeight: '400'
          }}>
            Connect your Discord account to manage bot notifications across your servers
          </p>
        </div>

        {/* Connection Card */}
        {!connected ? (
          <div style={{
            maxWidth: '600px',
            margin: '0 auto',
            border: '1px solid #e5e5e5',
            borderRadius: '8px',
            padding: '3rem',
            textAlign: 'center',
            backgroundColor: '#fff'
          }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1.5rem',
              border: '2px solid #000',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#000'
            }}>
              DS
            </div>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: '600',
              marginBottom: '0.75rem',
              color: '#000',
              letterSpacing: '-0.01em'
            }}>
              Connect Discord Account
            </h2>
            <p style={{
              color: '#666',
              marginBottom: '2rem',
              fontSize: '0.95rem',
              lineHeight: '1.6'
            }}>
              Link your Discord account to enable bot management and notification settings for your servers
            </p>
            <button
              onClick={connectDiscord}
              style={{
                padding: '0.875rem 2rem',
                backgroundColor: '#000',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = '#333';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = '#000';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Connect with Discord
            </button>
          </div>
        ) : (
          <div>
            {/* Connected User Card */}
            <div style={{
              border: '1px solid #e5e5e5',
              borderRadius: '8px',
              padding: '2rem',
              marginBottom: '2rem',
              backgroundColor: '#fff'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <img
                    src={getAvatarUrl(discordUser!.id, discordUser!.avatar)}
                    alt="Discord Avatar"
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      border: '2px solid #e5e5e5'
                    }}
                  />
                  <div>
                    <h2 style={{
                      fontSize: '1.25rem',
                      fontWeight: '600',
                      color: '#000',
                      marginBottom: '0.25rem',
                      letterSpacing: '-0.01em'
                    }}>
                      {discordUser!.username}
                      {discordUser!.discriminator && `#${discordUser!.discriminator}`}
                    </h2>
                    <p style={{
                      color: '#22c55e',
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      Connected
                    </p>
                  </div>
                </div>
                <button
                  onClick={disconnectDiscord}
                  style={{
                    padding: '0.625rem 1.25rem',
                    backgroundColor: 'transparent',
                    color: '#dc2626',
                    border: '1px solid #e5e5e5',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#dc2626';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.borderColor = '#dc2626';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#dc2626';
                    e.currentTarget.style.borderColor = '#e5e5e5';
                  }}
                >
                  Disconnect
                </button>
              </div>
            </div>

            {/* Servers Section */}
            <div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                marginBottom: '1.5rem',
                color: '#000',
                letterSpacing: '-0.01em'
              }}>
                Manage Servers
              </h3>
              {guilds.length === 0 ? (
                <div style={{
                  border: '1px solid #e5e5e5',
                  borderRadius: '8px',
                  padding: '3rem',
                  textAlign: 'center',
                  backgroundColor: '#fafafa'
                }}>
                  <p style={{ color: '#999', fontSize: '0.9rem' }}>
                    No servers found with admin permissions
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                  gap: '1.25rem'
                }}>
                  {guilds.map(guild => {
                    // Fetch settings on first render if bot is in server
                    if (guild.bot_in_server && !guildSettings[guild.id]) {
                      fetchGuildSettings(guild.id);
                    }
                    
                    return (
                    <div
                      key={guild.id}
                      style={{
                        border: '1px solid #e5e5e5',
                        borderRadius: '8px',
                        padding: '1.5rem',
                        backgroundColor: '#fff',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.borderColor = '#e5e5e5';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.875rem',
                        marginBottom: '1.25rem',
                        paddingBottom: '1rem',
                        borderBottom: '1px solid #f3f4f6'
                      }}>
                        {guild.icon ? (
                          <img
                            src={getGuildIconUrl(guild.id, guild.icon)!}
                            alt={guild.name}
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '50%',
                              border: '2px solid #f3f4f6'
                            }}
                          />
                        ) : (
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            backgroundColor: '#000',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            letterSpacing: '0.5px'
                          }}>
                            {getGuildInitials(guild.name)}
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <h4 style={{
                            fontWeight: '600',
                            fontSize: '1rem',
                            color: '#000',
                            marginBottom: '0.125rem',
                            letterSpacing: '-0.01em'
                          }}>
                            {guild.name}
                          </h4>
                          {guild.owner && (
                            <span style={{
                              fontSize: '0.8rem',
                              color: '#666',
                              fontWeight: '500'
                            }}>
                              Owner
                            </span>
                          )}
                        </div>
                      </div>

                      {!guild.bot_in_server ? (
                        <div>
                          <p style={{
                            fontSize: '0.875rem',
                            color: '#999',
                            marginBottom: '1rem'
                          }}>
                            Bot not added to this server
                          </p>
                          <a
                            href={getBotInviteUrl(guild.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-block',
                              padding: '0.625rem 1.25rem',
                              backgroundColor: '#000',
                              color: '#fff',
                              textDecoration: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              fontWeight: '500',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#333';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#000';
                            }}
                          >
                            Add Bot to Server
                          </a>
                        </div>
                      ) : (
                        <div>
                          <div style={{
                            marginBottom: '1rem',
                            paddingBottom: '1rem',
                            borderBottom: '1px solid #f3f4f6'
                          }}>
                            <label style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.625rem',
                              cursor: 'pointer'
                            }}>
                              <input
                                type="checkbox"
                                checked={guildSettings[guild.id]?.enabled ?? true}
                                onChange={e =>
                                  updateGuildSettings(guild.id, {
                                    enabled: e.target.checked
                                  })
                                }
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  cursor: 'pointer',
                                  accentColor: '#000'
                                }}
                              />
                              <span style={{
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                color: '#000'
                              }}>
                                Enable Notifications
                              </span>
                            </label>
                          </div>

                          <div>
                            <label style={{
                              display: 'block',
                              fontSize: '0.8rem',
                              fontWeight: '500',
                              color: '#666',
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              Notification Channel
                            </label>
                            <input
                              type="text"
                              placeholder="Enter channel ID"
                              value={guildSettings[guild.id]?.notification_channel_id || ''}
                              onChange={e =>
                                updateGuildSettings(guild.id, {
                                  notification_channel_id: e.target.value
                                })
                              }
                              style={{
                                width: '100%',
                                padding: '0.625rem',
                                backgroundColor: '#fff',
                                border: '1px solid #e5e5e5',
                                borderRadius: '6px',
                                fontSize: '0.875rem',
                                color: '#000',
                                transition: 'all 0.2s',
                                fontFamily: 'monospace'
                              }}
                              onFocus={(e) => {
                                e.currentTarget.style.borderColor = '#000';
                                e.currentTarget.style.outline = 'none';
                              }}
                              onBlur={(e) => {
                                e.currentTarget.style.borderColor = '#e5e5e5';
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
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

export default function DiscordConnectionPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}>
      <DiscordConnectionContent />
    </Suspense>
  );
}
