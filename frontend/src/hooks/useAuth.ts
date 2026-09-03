'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '@/src/store/authStore';
import apiClient from '@/src/lib/api-client';
import { LoginCredentials, RegisterCredentials } from '@/src/types';

interface UseAuthReturn {
  user: any;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    setAuth,
    logout: logoutStore,
    setLoading,
  } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken && !isAuthenticated) {
        try {
          const response = await apiClient.get('/users/me');
          setAuth(response.data, storedToken);
        } catch (error) {
          // Token is invalid
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
        }
      }
    };

    checkAuth();
  }, [isAuthenticated, setAuth]);

  // Login
  const login = async (credentials: LoginCredentials) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/login', credentials);
      const { access_token, refresh_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      setAuth(user, access_token);
      toast.success('Welcome back!');
      router.push('/');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Login failed';
      toast.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Register
  const register = async (credentials: RegisterCredentials) => {
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/register', credentials);
      const { access_token, refresh_token, user } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      setAuth(user, access_token);
      toast.success('Account created successfully!');
      router.push('/');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Registration failed';
      toast.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      // Ignore errors on logout
    } finally {
      logoutStore();
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      toast.success('Logged out');
      router.push('/login');
    }
  };

  // Refresh token
  const refreshToken = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) {
        throw new Error('No refresh token');
      }

      const response = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token } = response.data;
      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      
      if (user) {
        setAuth(user, access_token);
      }
    } catch (error) {
      // Refresh failed, logout
      logoutStore();
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      router.push('/login');
    } finally {
      setIsRefreshing(false);
    }
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
    refreshToken,
  };
}