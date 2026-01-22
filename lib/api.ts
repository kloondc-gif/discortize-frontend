// API Configuration
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  register: `${API_URL}/api/auth/register`,
  login: `${API_URL}/api/auth/login`,
  verifyEmail: `${API_URL}/api/auth/verify-email`,
  resendVerification: `${API_URL}/api/auth/resend-verification`,
  forgotPassword: `${API_URL}/api/auth/forgot-password`,
  resetPassword: `${API_URL}/api/auth/reset-password`,
  refreshToken: `${API_URL}/api/auth/refresh`,
};

// API Helper Functions
export async function apiRequest(
  endpoint: string,
  method: string = 'GET',
  body?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || 'An error occurred');
  }

  return data;
}

// Token refresh function
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    
    console.log('Attempting token refresh...');
    console.log('Refresh token from storage:', refreshToken ? 'exists' : 'missing');
    
    if (!refreshToken) {
      console.log('No refresh token found');
      return false;
    }

    const response = await fetch(API_ENDPOINTS.refreshToken, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.log('Token refresh failed:', response.status);
      // Refresh token is invalid or expired
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      return false;
    }

    const data = await response.json();
    
    console.log('Token refresh successful');
    // Update access token and user data
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    return false;
  }
}

// Auto-refresh token every 60 seconds
let refreshInterval: NodeJS.Timeout | null = null;

export function startTokenRefresh() {
  // Clear any existing interval
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }

  // Don't refresh immediately - let the user work with the initial token
  // Set up interval to refresh every 10 minutes (before 15 min expiry)
  refreshInterval = setInterval(async () => {
    const success = await refreshAccessToken();
    
    if (!success) {
      // Token refresh failed, stop the interval
      stopTokenRefresh();
      
      // Redirect to login if on a protected page
      if (typeof window !== 'undefined' && window.location.pathname === '/dashboard') {
        window.location.href = '/login';
      }
    }
  }, 600000); // 10 minutes (600,000 ms)
  
  console.log('Token refresh scheduled for every 10 minutes');
}

export function stopTokenRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
