'use client';

import { useState } from 'react';
import { X, FileText, File, Image, Code, PenTool } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CreateDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (title: string, type: string) => Promise<void>;
  isLoading?: boolean;
}

interface DocumentType {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
}

const documentTypes: DocumentType[] = [
  {
    id: 'blank',
    name: 'Blank Document',
    icon: <FileText className="w-6 h-6" />,
    description: 'Start with a blank page',
  },
  {
    id: 'letter',
    name: 'Letter',
    icon: <PenTool className="w-6 h-6" />,
    description: 'Formal letter template',
  },
  {
    id: 'report',
    name: 'Report',
    icon: <File className="w-6 h-6" />,
    description: 'Professional report layout',
  },
  {
    id: 'blog',
    name: 'Blog Post',
    icon: <FileText className="w-6 h-6" />,
    description: 'Blog post with headings',
  },
  {
    id: 'resume',
    name: 'Resume',
    icon: <FileText className="w-6 h-6" />,
    description: 'Professional resume template',
  },
  {
    id: 'code',
    name: 'Code Document',
    icon: <Code className="w-6 h-6" />,
    description: 'Document with code blocks',
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

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error('Please enter a document name');
      return;
    }

    await onCreate(title.trim(), selectedType);
  };

  const getTemplateContent = (type: string): string => {
    switch (type) {
      case 'letter':
        return `
          <h1>Letter</h1>
          <p><strong>Date:</strong> </p>
          <p><strong>To:</strong> </p>
          <p><strong>From:</strong> </p>
          <p>Dear </p>
          <p></p>
          <p>I am writing to...</p>
          <p></p>
          <p>Sincerely,</p>
          <p></p>
        `;
      case 'report':
        return `
          <h1>Report Title</h1>
          <h2>Executive Summary</h2>
          <p></p>
          <h2>Introduction</h2>
          <p></p>
          <h2>Findings</h2>
          <ul>
            <li>Point 1</li>
            <li>Point 2</li>
            <li>Point 3</li>
          </ul>
          <h2>Conclusion</h2>
          <p></p>
        `;
      case 'blog':
        return `
          <h1>Blog Post Title</h1>
          <p><em>Published on </em></p>
          <p></p>
          <h2>Introduction</h2>
          <p></p>
          <h2>Main Content</h2>
          <p></p>
          <h2>Conclusion</h2>
          <p></p>
        `;
      case 'resume':
        return `
          <h1>John Doe</h1>
          <p><strong>Email:</strong> john@example.com | <strong>Phone:</strong> (123) 456-7890</p>
          <hr />
          <h2>Professional Summary</h2>
          <p></p>
          <h2>Work Experience</h2>
          <h3>Job Title - Company Name</h3>
          <p><em>Date - Present</em></p>
          <ul>
            <li>Responsibility 1</li>
            <li>Responsibility 2</li>
          </ul>
          <h2>Education</h2>
          <h3>Degree - University</h3>
          <p><em>Date</em></p>
          <h2>Skills</h2>
          <ul>
            <li>Skill 1</li>
            <li>Skill 2</li>
          </ul>
        `;
      case 'code':
        return `
          <h1>Code Documentation</h1>
          <h2>Overview</h2>
          <p></p>
          <h2>Code Example</h2>
          <pre><code>
            // Your code here
            function example() {
              console.log('Hello World');
            }
          </code></pre>
          <h2>Explanation</h2>
          <p></p>
        `;
      default:
        return '<p>Start writing your document...</p>';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-linear-to-r from-blue-50 to-indigo-50">
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
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                  <div className="text-xs text-gray-500 mt-0.5">
                    {type.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

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
              disabled={isLoading || !title.trim()}
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