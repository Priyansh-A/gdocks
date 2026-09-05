import axios from 'axios';
import { useAuthStore } from '@/src/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

console.log('API_URL:', API_URL);

const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Log all requests in development
if (process.env.NODE_ENV === 'development') {
  apiClient.interceptors.request.use((config) => {
    // Safely construct the full URL
    const fullUrl = config.baseURL 
      ? `${config.baseURL}${config.url || ''}` 
      : config.url || '';
    
    console.log('Request:', config.method?.toUpperCase(), fullUrl);
    console.log('Request Headers:', config.headers);
    console.log('Request Data:', config.data);
    return config;
  });
}

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    console.error('Request Interceptor Error:', error);
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Response:', response.status, response.config.url);
      console.log('Response Data:', response.data);
    }
    return response;
  },
  async (error) => {
    // Detailed error logging
    console.error('FULL ERROR OBJECT:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Check if error is from axios
    if (error.isAxiosError) {
      console.error('Axios Error Details:', {
        message: error.message,
        code: error.code,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
        request: {
          headers: error.config?.headers,
          data: error.config?.data,
        },
      });
    } else {
      console.error('Non-Axios Error:', error);
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network Error - Backend might not be running');
      return Promise.reject(new Error('Cannot connect to server. Please check if backend is running on port 8000.'));
    }
    
    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }
        
        const response = await axios.post(`${API_URL}/refresh`, {
          refresh_token: refreshToken,
        });
        
        const { access_token, refresh_token } = response.data;
        localStorage.setItem('token', access_token);
        localStorage.setItem('refresh_token', refresh_token);
        
        const state = useAuthStore.getState();
        if (state.user) {
          state.setAuth(state.user, access_token);
        }
        
        error.config.headers.Authorization = `Bearer ${access_token}`;
        return apiClient(error.config);
      } catch (refreshError) {
        useAuthStore.getState().logout();
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;