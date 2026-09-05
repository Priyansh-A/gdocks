'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, Image as ImageIcon, File, Video, Music, Trash2, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import apiClient from '@/src/lib/api-client';
import { Media } from '@/src/types';
import Image from 'next/image';

interface MediaUploaderProps {
  documentId: string;
  onClose: () => void;
}

export function MediaUploader({ documentId, onClose }: MediaUploaderProps) {
  const [media, setMedia] = useState<Media[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true);
    setUploadProgress(0);

    for (const file of acceptedFiles) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post(
          `/media/upload?document_id=${documentId}`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            onUploadProgress: (progressEvent) => {
              const percentCompleted = Math.round(
                (progressEvent.loaded * 100) / (progressEvent.total || 1)
              );
              setUploadProgress(percentCompleted);
            },
          }
        );

        setMedia(prev => [response.data, ...prev]);
        toast.success(`Uploaded ${file.name}`);
      } catch (error: any) {
        toast.error(`Failed to upload ${file.name}: ${error.response?.data?.detail || 'Unknown error'}`);
      }
    }

    setUploading(false);
    setUploadProgress(0);
  }, [documentId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.mov'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
      'application/pdf': ['.pdf'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const deleteMedia = async (mediaId: string) => {
    try {
      await apiClient.delete(`/media/${mediaId}`);
      setMedia(prev => prev.filter(m => m.id !== mediaId));
      toast.success('Media deleted');
    } catch (error) {
      toast.error('Failed to delete media');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-blue-500" />;
    if (mimeType.startsWith('video/')) return <Video className="w-8 h-8 text-red-500" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-purple-500" />;
    return <File className="w-8 h-8 text-gray-500" />;
  };

  const getFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Upload area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">Drop your files here...</p>
            ) : (
              <>
                <p className="text-gray-600">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  Supports images, videos, audio, and PDFs (max 10MB)
                </p>
              </>
            )}
          </div>

          {uploading && (
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Media grid */}
          {media.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {media.map((item) => (
                <div
                  key={item.id}
                  className="group relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200"
                >
                  {/* Preview */}
                  <div className="aspect-square relative">
                    {item.mime_type.startsWith('image/') ? (
                      <img
                        src={item.thumbnail_url || item.storage_url}
                        alt={item.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : item.mime_type.startsWith('video/') ? (
                      <video
                        src={item.storage_url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-100">
                        {getFileIcon(item.mime_type)}
                      </div>
                    )}
                  </div>

                  {/* Info overlay */}
                  <div className="p-2 bg-white">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.file_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {getFileSize(item.file_size)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => window.open(item.storage_url, '_blank')}
                      className="p-1 bg-white rounded shadow hover:bg-gray-100"
                    >
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => deleteMedia(item.id)}
                      className="p-1 bg-white rounded shadow hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {media.length === 0 && !uploading && (
            <div className="text-center py-12">
              <ImageIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No media uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}