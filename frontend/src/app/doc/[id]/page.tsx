'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TiptapEditor } from '@/src/components/Editor/TiptapEditor';
import { ChatBox } from '@/src/components/Chat/ChatBox';
import { ActiveUsers } from '@/components/Collaboration/ActiveUsers';
import { ShareModal } from '@/src/components/Permissions/ShareModal';
import { MediaUploader } from '@/erc/components/Media/MediaUploader';
import { useAuthStore } from '@/src/store/authStore';
import { useDocument } from '@/src/hooks/useDocument';
import { wsClient } from '@/src/lib/websocket-client';
import { 
  Users, 
  Share2, 
  Image, 
  Menu, 
  Save, 
  Download,
  ArrowLeft
} from 'lucide-react';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const { isAuthenticated } = useAuthStore();
  const { document, loading, updateDocument, saveContent } = useDocument(documentId);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Connect to WebSocket
  useEffect(() => {
    if (isAuthenticated && documentId) {
      const token = localStorage.getItem('token');
      if (token) {
        wsClient.connect(documentId, token).catch(console.error);
      }
    }

    return () => {
      wsClient.disconnect();
    };
  }, [documentId, isAuthenticated]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveContent();
      // Show success notification
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (document?.content) {
      const blob = new Blob([document.content], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${document.title || 'document'}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {document?.title || 'Untitled Document'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>

            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <div className="w-px h-8 bg-gray-200" />

            <button
              onClick={() => setShowMediaUploader(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Image className="w-4 h-4" />
              Media
            </button>

            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow">
          <TiptapEditor
            documentId={documentId}
            initialContent={document?.content || ''}
          />
        </div>
      </div>

      {/* Chat */}
      <ChatBox documentId={documentId} />

      {/* Modals */}
      {showShareModal && (
        <ShareModal
          documentId={documentId}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showMediaUploader && (
        <MediaUploader
          documentId={documentId}
          onClose={() => setShowMediaUploader(false)}
        />
      )}
    </div>
  );
}