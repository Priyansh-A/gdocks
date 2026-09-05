'use client';

import { useState, useEffect } from 'react';
import { X, Copy, Check, UserPlus, Link2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { Permission } from '@/src/types';

interface ShareModalProps {
  documentId: string;
  onClose: () => void;
}

export function ShareModal({ documentId, onClose }: ShareModalProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor' | 'commenter'>('viewer');
  const [loading, setLoading] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [documentId]);

  const fetchPermissions = async () => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/permissions`);
      setPermissions(response.data);
    } catch (error) {
      toast.error('Failed to load permissions');
    }
  };

  const generateShareLink = async () => {
      setShareLink(`${window.location.origin}/share/${documentId}`)
  };

  const addPermission = async () => {
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post(`/documents/${documentId}/permissions`, {
        user_id: email,
        role,
      });
      toast.success('User added successfully');
      setEmail('');
      await fetchPermissions();
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to add user');
    } finally {
      setLoading(false);
    }
  };

  const removePermission = async (userId: string) => {
    try {
      await apiClient.delete(`/documents/${documentId}/permissions/${userId}`);
      toast.success('Permission removed');
      await fetchPermissions();
    } catch (error) {
      toast.error('Failed to remove permission');
    }
  };

  const updatePermission = async (userId: string, newRole: string) => {
    try {
      await apiClient.put(`/documents/${documentId}/permissions/${userId}`, {
        role: newRole,
      });
      toast.success('Permission updated');
      await fetchPermissions();
    } catch (error) {
      toast.error('Failed to update permission');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Link copied to clipboard');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Share Document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Share with people */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Add people
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="viewer">Viewer</option>
                <option value="commenter">Commenter</option>
                <option value="editor">Editor</option>
              </select>
              <button
                onClick={addPermission}
                disabled={loading || !email}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* People list */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              People with access
            </h3>
            <div className="space-y-2">
              {permissions.map((perm) => (
                <div
                  key={perm.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                      {perm.user_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        User {perm.user_id.substring(0, 8)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {perm.role}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={perm.role}
                      onChange={(e) => updatePermission(perm.user_id, e.target.value)}
                      className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="commenter">Commenter</option>
                      <option value="editor">Editor</option>
                    </select>
                    <button
                      onClick={() => removePermission(perm.user_id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              {permissions.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-4">
                  No one has access yet
                </p>
              )}
            </div>
          </div>

          {/* Share link */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Share link
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <Link2 className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 bg-transparent text-sm text-gray-600 outline-none"
                />
              </div>
              <button
                onClick={copyLink}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}