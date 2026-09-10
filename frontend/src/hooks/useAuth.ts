'use client';

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
}

export function useAuth(): UseAuthReturn {
  const router = useRouter();
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    setAuth,
    logout: storeLogout,
  } = useAuthStore();

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await apiClient.post('/login', credentials);
      const { access_token, refresh_token, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuth(user, access_token);

      toast.success('Welcome back!');
      router.push('/dashboard');
    } catch (error: any) {
      const msg =
        error.response?.data?.detail || error.message || 'Login failed';
      toast.error(msg);
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      const response = await apiClient.post('/register', {
        email: credentials.email,
        username: credentials.username,
        password: credentials.password,
        full_name: credentials.full_name || '',
      });

      const { access_token, refresh_token, user } = response.data;

      localStorage.setItem('token', access_token);
      localStorage.setItem('refresh_token', refresh_token);
      setAuth(user, access_token);

      toast.success('Account created successfully!');
      router.push('/dashboard');
    } catch (error: any) {
      const msg =
        error.response?.data?.detail ||
        error.message ||
        'Registration failed';
      toast.error(msg);
      throw error;
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    // Call backend logout, but skip the interceptor (don't try to refresh).
    // Sending the refresh token lets the backend revoke the session server-side
    // even when the access token has already expired.
    try {
      await apiClient.post(
        '/logout',
        { refresh_token: refreshToken },
        { headers: { 'Skip-Auth-Refresh': '1' } },
      );
    } catch {
      // Backend may already be unreachable — still clean up locally
    }

    storeLogout();
    router.push('/login');
  };

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    login,
    register,
    logout,
  };
}