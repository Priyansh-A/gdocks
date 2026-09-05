'use client';
import { downloadFile } from '@/src/utils/export';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { TiptapEditor } from '@/src/components/Editor/TiptapEditor';
import { ChatBox } from '@/src/components/Chat/ChatBox';
import { ShareModal } from '@/src/components/Permissions/ShareModal';
import { MediaUploader } from '@/src/components/Media/MediaUploader';
import { CommentSection } from '@/src/components/Comments/CommentSection';
import { VersionHistory } from '@/src/components/Document/VersionHistory';
import { useAuthStore } from '@/src/store/authStore';
import { useDocument } from '@/src/hooks/useDocument';
import { wsClient } from '@/src/lib/websocket-client';
import { 
  Share2, 
  Image, 
  Save, 
  Download,
  ArrowLeft,
  Clock,
  MessageSquare
} from 'lucide-react';

export default function DocumentPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const { isAuthenticated } = useAuthStore();
  const { document, loading, updateDocument, saveContent, content, setContent } = useDocument(documentId);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag to avoid SSR issues
  useEffect(() => {
    setIsClient(true);
  }, []);

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
        wsClient.connect(documentId, token).catch((error) => {
          console.error('WebSocket connection error:', error);
        });
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
      toast.success('Document saved');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };


  const handleExport = () => {
    if (!content) return;
    downloadFile(content, `${document?.title || 'document'}.html`);
  };

  const handleRestore = (restoredContent: string) => {
    setContent(restoredContent);
    updateDocument({ content: restoredContent });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!isClient) {
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
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                showComments 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Comments
            </button>

            <button
              onClick={() => setShowVersionHistory(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Clock className="w-4 h-4" />
              History
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
            initialContent={content || ''}
          />
        </div>
      </div>

      {/* Chat */}
      <ChatBox documentId={documentId} />

      {/* Comments */}
      {showComments && (
        <CommentSection documentId={documentId} />
      )}

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

      {showVersionHistory && (
        <VersionHistory
          documentId={documentId}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestore}
        />
      )}
    </div>
  );
}