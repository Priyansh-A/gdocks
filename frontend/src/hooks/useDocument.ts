'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { Document, DocumentWithPermissions, Permission } from '@/src/types';

interface UseDocumentReturn {
  document: DocumentWithPermissions | null;
  loading: boolean;
  error: string | null;
  content: string;
  setContent: (content: string) => void;
  fetchDocument: (id: string) => Promise<void>;
  updateDocument: (data: Partial<Document>) => Promise<void>;
  saveContent: () => Promise<void>;
  deleteDocument: () => Promise<void>;
  archiveDocument: () => Promise<void>;
  restoreDocument: () => Promise<void>;
  addPermission: (userId: string, role: Permission['role']) => Promise<void>;
  removePermission: (userId: string) => Promise<void>;
  updatePermission: (userId: string, role: Permission['role']) => Promise<void>;
}

export function useDocument(documentId: string): UseDocumentReturn {
  const router = useRouter();
  const [document, setDocument] = useState<DocumentWithPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');

  // Fetch document
  const fetchDocument = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/documents/${id}`);
      const doc = response.data;
      setDocument(doc);
      setContent(doc.content || '');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to load document';
      setError(errorMsg);
      toast.error(errorMsg);
      if (err.response?.status === 404) {
        router.push('/dashboard');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Update document metadata
  const updateDocument = useCallback(async (data: Partial<Document>) => {
    if (!document) return;
    
    try {
      const response = await apiClient.put(`/documents/${document.id}`, data);
      setDocument(response.data);
      toast.success('Document updated');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to update document';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Save content
  const saveContent = useCallback(async () => {
    if (!document) return;
    
    try {
      const response = await apiClient.put(`/documents/${document.id}`, {
        content: content,
      });
      setDocument(response.data);
      toast.success('Document saved');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to save document';
      toast.error(errorMsg);
      throw err;
    }
  }, [document, content]);

  // Delete document
  const deleteDocument = useCallback(async () => {
    if (!document) return;
    
    try {
      await apiClient.delete(`/documents/${document.id}`);
      toast.success('Document deleted');
      router.push('/dashboard');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete document';
      toast.error(errorMsg);
      throw err;
    }
  }, [document, router]);

  // Archive document
  const archiveDocument = useCallback(async () => {
    if (!document) return;
    
    try {
      await apiClient.put(`/documents/${document.id}`, {
        is_archived: true,
      });
      setDocument(prev => prev ? { ...prev, is_archived: true } : null);
      toast.success('Document archived');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to archive document';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Restore document from archive
  const restoreDocument = useCallback(async () => {
    if (!document) return;
    
    try {
      await apiClient.put(`/documents/${document.id}`, {
        is_archived: false,
      });
      setDocument(prev => prev ? { ...prev, is_archived: false } : null);
      toast.success('Document restored');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to restore document';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Add permission
  const addPermission = useCallback(async (userId: string, role: Permission['role']) => {
    if (!document) return;
    
    try {
      const response = await apiClient.post(`/documents/${document.id}/permissions`, {
        user_id: userId,
        role,
      });
      setDocument(prev => ({
        ...prev!,
        permissions: [...(prev?.permissions || []), response.data],
      }));
      toast.success('Permission added');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to add permission';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Remove permission
  const removePermission = useCallback(async (userId: string) => {
    if (!document) return;
    
    try {
      await apiClient.delete(`/documents/${document.id}/permissions/${userId}`);
      setDocument(prev => ({
        ...prev!,
        permissions: prev?.permissions?.filter(p => p.user_id !== userId) || [],
      }));
      toast.success('Permission removed');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to remove permission';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Update permission
  const updatePermission = useCallback(async (userId: string, role: Permission['role']) => {
    if (!document) return;
    
    try {
      await apiClient.put(`/documents/${document.id}/permissions/${userId}`, {
        role,
      });
      
      setDocument(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          permissions: prev.permissions.map((p) =>
            p.user_id === userId ? { ...p, role } : p
          )
        };
      });
      
      toast.success('Permission updated');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to update permission';
      toast.error(errorMsg);
      throw err;
    }
  }, [document]);

  // Auto-save content (debounced)
  useEffect(() => {
    if (!document) return;

    const saveTimeout = setTimeout(() => {
      if (content !== document.content) {
        saveContent();
      }
    }, 5000);

    return () => clearTimeout(saveTimeout);
  }, [content, document, saveContent]);

  // Initial fetch
  useEffect(() => {
    if (documentId) {
      fetchDocument(documentId);
    }
  }, [documentId, fetchDocument]);

  return {
    document,
    loading,
    error,
    content,
    setContent,
    fetchDocument,
    updateDocument,
    saveContent,
    deleteDocument,
    archiveDocument,
    restoreDocument,
    addPermission,
    removePermission,
    updatePermission,
  };
}