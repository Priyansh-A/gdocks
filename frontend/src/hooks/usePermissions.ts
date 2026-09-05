'use client';

import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { Permission } from '@/src/types';

interface UsePermissionsReturn {
  permissions: Permission[];
  loading: boolean;
  fetchPermissions: (documentId: string) => Promise<void>;
  addPermission: (documentId: string, userId: string, role: string) => Promise<void>;
  removePermission: (documentId: string, userId: string) => Promise<void>;
  updatePermission: (documentId: string, userId: string, role: string) => Promise<void>;
  checkPermission: (documentId: string, requiredRole: string) => Promise<boolean>;
}

export function usePermissions(): UsePermissionsReturn {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch permissions for a document
  const fetchPermissions = useCallback(async (documentId: string) => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/documents/${documentId}/permissions`);
      setPermissions(response.data);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to load permissions';
      toast.error(errorMsg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  // Add permission
  const addPermission = useCallback(async (
    documentId: string,
    userId: string,
    role: string
  ) => {
    try {
      const response = await apiClient.post(`/documents/${documentId}/permissions`, {
        user_id: userId,
        role,
      });
      setPermissions(prev => [...prev, response.data]);
      toast.success('Permission added');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to add permission';
      toast.error(errorMsg);
      throw error;
    }
  }, []);

  // Remove permission
  const removePermission = useCallback(async (documentId: string, userId: string) => {
    try {
      await apiClient.delete(`/documents/${documentId}/permissions/${userId}`);
      setPermissions(prev => prev.filter(p => p.user_id !== userId));
      toast.success('Permission removed');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to remove permission';
      toast.error(errorMsg);
      throw error;
    }
  }, []);

  // Update permission
  const updatePermission = useCallback(async (
    documentId: string,
    userId: string,
    role: string
  ) => {
    try {
      await apiClient.put(`/documents/${documentId}/permissions/${userId}`, {
        role,
      });
      setPermissions(prev =>
        prev.map(p =>
          p.user_id === userId ? { ...p, role: role as Permission['role'] } : p
        )
      );
      toast.success('Permission updated');
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to update permission';
      toast.error(errorMsg);
      throw error;
    }
  }, []);

  // Check if user has a specific permission
  const checkPermission = useCallback(async (documentId: string, requiredRole: string) => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/check-permission`, {
        params: { role: requiredRole },
      });
      return response.data.has_permission;
    } catch (error) {
      return false;
    }
  }, []);

  return {
    permissions,
    loading,
    fetchPermissions,
    addPermission,
    removePermission,
    updatePermission,
    checkPermission,
  };
}