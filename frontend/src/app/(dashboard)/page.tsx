'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Users, Clock, Archive, Trash2, MoreVertical } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/src/hooks/useAuth';
import { useDocumentList } from '@/src/hooks/useDocumentList';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { documents, loading, createDocument, deleteDocument, archiveDocument, restoreDocument } = useDocumentList();
  const [creating, setCreating] = useState(false);

  const handleCreateDocument = async () => {
    setCreating(true);
    try {
      const doc = await createDocument('Untitled Document');
      router.push(`/doc/${doc.id}`);
    } catch (error) {
      // Error already handled by hook
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  const activeDocs = documents.filter(d => !d.is_archived);
  const archivedDocs = documents.filter(d => d.is_archived);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name || user?.username}!
          </h1>
          <p className="text-gray-600 mt-1">Here are your documents</p>
        </div>
        <button
          onClick={handleCreateDocument}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          {creating ? 'Creating...' : 'New Document'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-gray-600">Total Documents</p>
              <p className="text-2xl font-bold">{documents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-gray-600">Shared With Me</p>
              <p className="text-2xl font-bold">
                {documents.filter(d => d.owner_id !== user?.id).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Archive className="w-8 h-8 text-yellow-500" />
            <div>
              <p className="text-sm text-gray-600">Archived</p>
              <p className="text-2xl font-bold">{archivedDocs.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-gray-600">Last Edited</p>
              <p className="text-sm font-medium">
                {documents.length > 0 
                  ? new Date(documents[0]?.last_edited_at).toLocaleDateString()
                  : 'No documents'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Documents */}
      {activeDocs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Documents</h2>
          <DocumentList 
            documents={activeDocs} 
            onDelete={deleteDocument}
            onArchive={archiveDocument}
            onRestore={restoreDocument}
          />
        </div>
      )}

      {/* Archived Documents */}
      {archivedDocs.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Archived Documents</h2>
          <DocumentList 
            documents={archivedDocs} 
            onDelete={deleteDocument}
            onArchive={archiveDocument}
            onRestore={restoreDocument}
            showRestore
          />
        </div>
      )}

      {documents.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
          <p className="text-gray-600 mt-2">Create your first document to get started</p>
          <button
            onClick={handleCreateDocument}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Document
          </button>
        </div>
      )}
    </div>
  );
}

// Document List Component
function DocumentList({ 
  documents, 
  onDelete, 
  onArchive, 
  onRestore,
  showRestore = false 
}: any) {
  const router = useRouter();

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Owner
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Edited
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc: any) => (
            <tr
              key={doc.id}
              className="hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td 
                className="px-6 py-4 whitespace-nowrap"
                onClick={() => router.push(`/doc/${doc.id}`)}
              >
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-gray-400 mr-3" />
                  <div className="text-sm font-medium text-gray-900">
                    {doc.title}
                  </div>
                </div>
              </td>
              <td 
                className="px-6 py-4 whitespace-nowrap"
                onClick={() => router.push(`/doc/${doc.id}`)}
              >
                <div className="text-sm text-gray-600">
                  {doc.owner_id === 'you' ? 'You' : 'Shared'}
                </div>
              </td>
              <td 
                className="px-6 py-4 whitespace-nowrap"
                onClick={() => router.push(`/doc/${doc.id}`)}
              >
                <div className="text-sm text-gray-600">
                  {new Date(doc.last_edited_at).toLocaleString()}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  {showRestore ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestore(doc.id);
                      }}
                      className="text-sm text-green-600 hover:text-green-700"
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArchive(doc.id);
                      }}
                      className="text-sm text-yellow-600 hover:text-yellow-700"
                    >
                      Archive
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this document?')) {
                        onDelete(doc.id);
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}