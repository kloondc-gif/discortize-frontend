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
  body?: any,
  includeAuth: boolean = false
) {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  // Add authorization header if requested
  if (includeAuth) {
    const token = localStorage.getItem('token');
    if (token) {
      (options.headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(endpoint, options);
  
  // Handle 401 Unauthorized - token expired
  if (response.status === 401) {
    console.log('Received 401 - attempting token refresh...');
    const refreshed = await refreshAccessToken();
    
    if (refreshed) {
      // Retry the request with new token
      const newToken = localStorage.getItem('token');
      if (newToken && includeAuth) {
        (options.headers as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
      }
      
      const retryResponse = await fetch(endpoint, options);
      const retryData = await retryResponse.json();
      
      if (!retryResponse.ok) {
        throw new Error(retryData.detail || 'An error occurred');
      }
      
      return retryData;
    } else {
      // Refresh failed - user will be logged out by handleLogout()
      throw new Error('Session expired. Please log in again.');
    }
  }

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
      handleLogout();
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
      handleLogout();
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
    handleLogout();
    return false;
  }
}

// Handle logout when tokens expire
export function handleLogout() {
  console.log('Tokens expired - logging out...');
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  
  // Stop token refresh
  stopTokenRefresh();
  
  // Redirect to login if on a protected page
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/verify-email')) {
      window.location.href = '/login';
    }
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
