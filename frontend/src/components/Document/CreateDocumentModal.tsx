'use client';

import { useState } from 'react';
import { X, FileText, File, Image, Code, PenTool, Film } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, type: string, file?: File) => Promise<void>;
  isLoading?: boolean;
}

interface DocumentTypeOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  backendType: 'document' | 'pdf' | 'media';
  acceptsFile?: boolean;
}

const documentTypes: DocumentTypeOption[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    icon: <FileText className="w-6 h-6" />,
    description: 'Start with a blank page',
    backendType: 'document',
  },
  {
    id: 'letter',
    name: 'Letter',
    icon: <PenTool className="w-6 h-6" />,
    description: 'Formal letter template',
    backendType: 'document',
  },
  {
    id: 'report',
    name: 'Report',
    icon: <File className="w-6 h-6" />,
    description: 'Professional report layout',
    backendType: 'document',
  },
  {
    id: 'blog',
    name: 'Blog Post',
    icon: <FileText className="w-6 h-6" />,
    description: 'Blog post with headings',
    backendType: 'document',
  },
  {
    id: 'resume',
    name: 'Resume',
    icon: <FileText className="w-6 h-6" />,
    description: 'Professional resume template',
    backendType: 'document',
  },
  {
    id: 'code',
    name: 'Code Document',
    icon: <Code className="w-6 h-6" />,
    description: 'Document with code blocks',
    backendType: 'document',
  },
  {
    id: 'pdf',
    name: 'PDF Document',
    icon: <File className="w-6 h-6 text-red-500" />,
    description: 'Upload a PDF file to view and annotate',
    backendType: 'pdf',
    acceptsFile: true,
  },
  {
    id: 'media',
    name: 'Media File',
    icon: <Film className="w-6 h-6 text-purple-500" />,
    description: 'Upload images, videos, or audio',
    backendType: 'media',
    acceptsFile: true,
  },
];

export function CreateDocumentModal({
  isOpen,
  onClose,
  onCreate,
  isLoading = false,
}: CreateDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<string>('blank');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a document name');
      return;
    }

    const selectedOption = documentTypes.find(t => t.id === selectedType);
    if (selectedOption?.acceptsFile && !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    await onCreate(title, selectedType, selectedFile || undefined);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const selectedOption = documentTypes.find(t => t.id === selectedType);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Create New Document</h2>
            <p className="text-sm text-gray-500 mt-1">Choose a template and name your document</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Document Name */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Document Name
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document name..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-400"
              autoFocus
              disabled={isLoading}
            />
          </div>

          {/* Document Types */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Template
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {documentTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedType === type.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  disabled={isLoading}
                >
                  <div className={`${
                    selectedType === type.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {type.icon}
                  </div>
                  <div className="mt-2 font-medium text-sm text-gray-900">
                    {type.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* File Upload for PDF/Media */}
          {selectedOption?.acceptsFile && (
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select File
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept={selectedType === 'pdf' ? '.pdf' : 'image/*,video/*,audio/*'}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                  disabled={isLoading}
                />
                {selectedFile && (
                  <span className="text-sm text-gray-600">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {selectedType === 'pdf' ? 'Upload a PDF file' : 'Upload images, videos, or audio files'}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !title.trim() || (selectedOption?.acceptsFile && !selectedFile)}
              className="px-6 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Create Document
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}