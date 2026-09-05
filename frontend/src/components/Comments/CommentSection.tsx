'use client';

import { useState, useEffect } from 'react';
import { MessageSquare, X, Send, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { useAuthStore } from '@/src/store/authStore';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  username: string;
  created_at: string;
  resolved: boolean;
  replies: Comment[];
}

interface CommentSectionProps {
  documentId: string;
  selection?: { start: number; end: number };
}

export function CommentSection({ documentId, selection }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    fetchComments();
  }, [documentId]);

  const fetchComments = async () => {
    try {
      const response = await apiClient.get(`/documents/${documentId}/comments`);
      setComments(response.data);
    } catch (error: any) {
      // Don't show error for 404 - comments endpoint may not exist yet
      if (error.response?.status !== 404) {
        toast.error('Failed to load comments');
      }
      // Set empty comments array
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await apiClient.post(`/documents/${documentId}/comments`, {
        content: newComment,
        selection: selection || null,
      });
      setComments(prev => [response.data, ...prev]);
      setNewComment('');
      toast.success('Comment added');
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Failed to add comment');
      }
    }
  };

  const resolveComment = async (commentId: string) => {
    try {
      await apiClient.put(`/documents/${documentId}/comments/${commentId}`, {
        resolved: true,
      });
      setComments(prev =>
        prev.map(c =>
          c.id === commentId ? { ...c, resolved: true } : c
        )
      );
      toast.success('Comment resolved');
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Failed to resolve comment');
      }
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await apiClient.delete(`/documents/${documentId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment deleted');
    } catch (error: any) {
      if (error.response?.status !== 404) {
        toast.error('Failed to delete comment');
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 left-4 bg-white p-3 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <MessageSquare className="w-6 h-6 text-gray-600" />
        {comments.filter(c => !c.resolved).length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs rounded-full flex items-center justify-center">
            {comments.filter(c => !c.resolved).length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 w-96 max-h-150 bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-500" />
          <h3 className="font-semibold text-gray-900">Comments</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No comments yet</p>
          </div>
        ) : (
          comments.map((comment, index) => (
            <div
              key={comment.id || index}
              className={`p-3 rounded-lg ${
                comment.resolved ? 'bg-gray-50 opacity-60' : 'bg-blue-50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium shrink-0">
                  {comment.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {comment.username || 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(comment.created_at).toLocaleString()}
                      </span>
                    </div>
                    {comment.user_id === user?.id && (
                      <div className="flex items-center gap-1">
                        {!comment.resolved && (
                          <button
                            onClick={() => resolveComment(comment.id)}
                            className="text-xs text-green-600 hover:text-green-700"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteComment(comment.id)}
                          className="text-xs text-red-500 hover:text-red-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${
                    comment.resolved ? 'line-through' : ''
                  }`}>
                    {comment.content}
                  </p>
                  {comment.resolved && (
                    <span className="text-xs text-green-600 mt-1 inline-block">
                      Resolved
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                addComment();
              }
            }}
          />
          <button
            onClick={addComment}
            disabled={!newComment.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}