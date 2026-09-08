'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { Document} from '@/src/types';

interface UseDocumentListReturn {
  documents: Document[];
  loading: boolean;
  error: string | null;
  fetchDocuments: () => Promise<void>;
  createDocument: (title: string, type: string, file?: File) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  archiveDocument: (id: string) => Promise<void>;
  restoreDocument: (id: string) => Promise<void>;
}

export function useDocumentList(): UseDocumentListReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all documents
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/documents/');
      setDocuments(response.data);
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to load documents';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new document
  const createDocument = useCallback(async (title: string, type: string, file?: File) => {
    try {
      let response;
      
      if (file) {
        // For PDF and Media, upload file first
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('document_type', type === 'pdf' ? 'pdf' : 'media');
        
        // Upload file to media endpoint first
        const uploadResponse = await apiClient.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          params: { document_id: 'temp' } // Will be replaced
        });
        
        // Then create document with file info
        const docData = {
          title: title,
          document_type: type === 'pdf' ? 'pdf' : 'media',
          file_url: uploadResponse.data.storage_url,
          file_metadata: {
            originalName: file.name,
            fileSize: file.size,
            mimeType: file.type,
            publicId: uploadResponse.data.public_id,
          }
        };
        
        response = await apiClient.post('/documents/', docData);
      } else {
        // Regular document
        const templateContent = getTemplateContent(type);
        response = await apiClient.post('/documents/', {
          title: title,
          document_type: 'document',
          content: templateContent,
        });
      }
      
      const newDoc = response.data;
      setDocuments(prev => [newDoc, ...prev]);
      toast.success('Document created');
      return newDoc;
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to create document';
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  const getTemplateContent = (type: string): string => {
    switch (type) {
      case 'letter':
        return '<h1>Letter</h1><p><strong>Date:</strong> </p><p><strong>To:</strong> </p><p><strong>From:</strong> </p><p>Dear </p><p></p><p>I am writing to...</p>';
      case 'report':
        return '<h1>Report Title</h1><h2>Executive Summary</h2><p></p><h2>Introduction</h2><p></p><h2>Findings</h2><ul><li>Point 1</li><li>Point 2</li></ul><h2>Conclusion</h2><p></p>';
      case 'blog':
        return '<h1>Blog Post Title</h1><p><em>Published on </em></p><p></p><h2>Introduction</h2><p></p><h2>Main Content</h2><p></p><h2>Conclusion</h2><p></p>';
      case 'resume':
        return '<h1>John Doe</h1><p><strong>Email:</strong> john@example.com | <strong>Phone:</strong> (123) 456-7890</p><hr /><h2>Professional Summary</h2><p></p><h2>Work Experience</h2><h3>Job Title - Company Name</h3><p><em>Date - Present</em></p><ul><li>Responsibility 1</li></ul>';
      case 'code':
        return '<h1>Code Documentation</h1><h2>Overview</h2><p></p><h2>Code Example</h2><pre><code>function example() {\n  console.log("Hello World");\n}</code></pre>';
      default:
        return '<p>Start writing your document...</p>';
    }
  };

  // Delete a document
  const deleteDocument = useCallback(async (id: string) => {
    try {
      await apiClient.delete(`/documents/${id}`);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      toast.success('Document deleted');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to delete document';
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  // Archive a document
  const archiveDocument = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/documents/${id}/archive`);
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === id ? { ...doc, is_archived: true } : doc
        )
      );
      toast.success('Document archived');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to archive document';
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  // Restore a document from archive
  const restoreDocument = useCallback(async (id: string) => {
    try {
      await apiClient.post(`/documents/${id}/restore`);
      setDocuments(prev =>
        prev.map(doc =>
          doc.id === id ? { ...doc, is_archived: false } : doc
        )
      );
      toast.success('Document restored');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to restore document';
      toast.error(errorMsg);
      throw err;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return {
    documents,
    loading,
    error,
    fetchDocuments,
    createDocument,
    deleteDocument,
    archiveDocument,
    restoreDocument,
  };
}