'use client';

import { useState } from 'react';
import apiClient from '@/src/lib/api-client';

export function ApiTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testApi = async () => {
    setLoading(true);
    setError(null);
    try {
      // Test health endpoint
      const response = await apiClient.get('/health');
      setResult(response.data);
      console.log('✅ API Test Success:', response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'API test failed';
      setError(errorMsg);
      console.error('❌ API Test Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No token found. Please login first.');
        setLoading(false);
        return;
      }
      
      const response = await apiClient.get('/users/me');
      setResult(response.data);
      console.log('✅ Auth Test Success:', response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || err.message || 'Auth test failed';
      setError(errorMsg);
      console.error('❌ Auth Test Failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold mb-2">API Connection Test</h3>
      <div className="flex gap-2 mb-4">
        <button
          onClick={testApi}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test API'}
        </button>
        <button
          onClick={testAuth}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Auth'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-2 rounded mb-2">
          ❌ Error: {error}
        </div>
      )}
      
      {result && (
        <div className="bg-green-100 text-green-700 p-2 rounded">
          ✅ Success: <pre className="text-xs mt-1">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      
      <div className="text-sm text-gray-600 mt-2">
        <p>API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}</p>
        <p>Token: {localStorage.getItem('token') ? '✅ Present' : '❌ Missing'}</p>
      </div>
    </div>
  );
}