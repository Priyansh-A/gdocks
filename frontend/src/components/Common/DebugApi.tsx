'use client';

import { useState } from 'react';
import apiClient from '@/src/lib/api-client';

export function DebugApi() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<any>(null);

  const testHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/health');
      setResult(response.data);
      console.log('Health check:', response.data);
    } catch (err) {
      setError(err);
      console.error('Health check failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const testRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/register', {
        email: `test${Date.now()}@example.com`,
        username: `testuser${Date.now()}`,
        password: 'Test1234',
        full_name: 'Test User',
      });
      setResult(response.data);
      console.log('Register test:', response.data);
    } catch (err) {
      setError(err);
      console.error('Register test failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h3 className="font-bold mb-2">API Debug</h3>
      <div className="space-y-2">
        <button
          onClick={testHealth}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 mr-2"
        >
          Test Health
        </button>
        <button
          onClick={testRegister}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Register
        </button>
      </div>
      
      {loading && <div className="mt-2">Loading...</div>}
      
      {error && (
        <div className="mt-2 p-2 bg-red-100 text-red-700 rounded text-sm">
          <strong>Error:</strong>
          <pre className="mt-1 whitespace-pre-wrap">
            {JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}
          </pre>
        </div>
      )}
      
      {result && (
        <div className="mt-2 p-2 bg-green-100 text-green-700 rounded text-sm">
          <strong>Success:</strong>
          <pre className="mt-1 whitespace-pre-wrap">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
      
      <div className="mt-2 text-xs text-gray-600">
        <p>API URL: {process.env.NEXT_PUBLIC_API_URL}</p>
        <p>Token: {localStorage.getItem('token') ? 'Present' : 'Missing'}</p>
      </div>
    </div>
  );
}