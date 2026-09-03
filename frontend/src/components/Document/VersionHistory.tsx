'use client';

import { useState, useEffect } from 'react';
import { X, Clock, RotateCcw, User, ChevronDown } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

interface Version {
  id: string;
  version: number;
  snapshot: string;
  user_id: string;
  username: string;
  created_at: string;
}

interface VersionHistoryProps {
  documentId: string;
  onClose: () => void;
  onRestore: (content: string) => void;
}

export function VersionHistory({ documentId, onClose, onRestore }: VersionHistoryProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

  useEffect(() => {
    fetchVersions();
  }, [documentId]);

  const fetchVersions = async () => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/versions`);
      setVersions(response.data);
      if (response.data.length > 0) {
        setSelectedVersion(response.data[0]);
      }
    } catch (error) {
      toast.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  const restoreVersion = async (version: Version) => {
    try {
      await apiClient.post(`/documents/${documentId}/restore/${version.id}`);
      onRestore(version.snapshot);
      toast.success(`Restored version ${version.version}`);
      onClose();
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-500" />
            <h2 className="text-xl font-semibold text-gray-900">Version History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-125">
          {/* Version list */}
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto p-4">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No versions available</p>
            ) : (
              <div className="space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedVersion?.id === version.id
                        ? 'bg-blue-50 border-blue-500'
                        : 'hover:bg-gray-50'
                    } border-2 ${
                      selectedVersion?.id === version.id
                        ? 'border-blue-500'
                        : 'border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900">
                        Version {version.version}
                      </span>
                      {version.version === versions[0]?.version && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <User className="w-3 h-3" />
                      <span>{version.username || 'Unknown'}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(version.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedVersion && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">
                    Preview - Version {selectedVersion.version}
                  </h3>
                  {selectedVersion.version !== versions[0]?.version && (
                    <button
                      onClick={() => restoreVersion(selectedVersion)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Restore this version
                    </button>
                  )}
                </div>
                <div className="prose prose-sm max-w-none p-4 bg-gray-50 rounded-lg">
                  <div dangerouslySetInnerHTML={{ __html: selectedVersion.snapshot }} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}