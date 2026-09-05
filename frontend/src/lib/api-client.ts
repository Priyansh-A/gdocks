import axios from 'axios';
import { useAuthStore } from '@/src/store/authStore';

// Use environment variable with fallback
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Log requests in development
if (process.env.NODE_ENV === 'development') {
  apiClient.interceptors.request.use((config) => {
    console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  });
}

// Request interceptor to add token
apiClient.interceptors.request.use(
  (config) => {
    // Try to get token from localStorage
    let token = localStorage.getItem('token');
    
    // Also try from store
    if (!token) {
      const state = useAuthStore.getState();
      token = state.token || null;
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh
apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Log errors in development
    if (process.env.NODE_ENV === 'development') {
      console.error(`❌ API Error:`, {
        url: error.config?.url,
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
    }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        // Update store
        const state = useAuthStore.getState();
        if (state.user) {
          state.setAuth(state.user, access_token);
        }
        
        originalRequest.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout
        useAuthStore.getState().logout();
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        
        // Redirect to login if not already there
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;