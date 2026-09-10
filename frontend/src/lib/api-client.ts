import axios from 'axios';
import { useAuthStore } from '@/src/store/authStore';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Attach token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Singleton refresh — only one refresh in-flight at a time
let refreshPromise: Promise<string> | null = null;

async function tryRefresh(): Promise<string> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) throw new Error('No refresh token');

  const { data } = await axios.post(`${API_URL}/refresh`, {
    refresh_token: refreshToken,
  });

  const { access_token, refresh_token: newRefresh } = data;
  localStorage.setItem('token', access_token);
  localStorage.setItem('refresh_token', newRefresh);

  const { user } = useAuthStore.getState();
  if (user) {
    useAuthStore.getState().setAuth(user, access_token);
  }

  return access_token;
}

function forceLogout() {
  useAuthStore.getState().logout();
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// Handle 401s with singleton refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (!error.response) {
      return Promise.reject(
        new Error('Cannot connect to server. Please check if the backend is running.'),
      );
    }

    const originalRequest = error.config;

    // Skip refresh for requests opted out via header (e.g. logout)
    if (originalRequest.headers['Skip-Auth-Refresh']) {
      return Promise.reject(error);
    }

    // Only attempt refresh once per request, and never for the refresh endpoint itself
    if (
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/refresh')
    ) {
      originalRequest._retry = true;

      try {
        // Reuse existing refresh if one is already in-flight
        if (!refreshPromise) {
          refreshPromise = tryRefresh().finally(() => {
            refreshPromise = null;
          });
        }
        const newToken = await refreshPromise;
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch {
        forceLogout();
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;