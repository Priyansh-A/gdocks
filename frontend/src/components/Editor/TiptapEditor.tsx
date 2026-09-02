'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorToolbar } from './EditorToolbar';
import { useAuthStore } from '@/src/store/authStore';
import { wsClient } from '@/src/lib/websocket-client';
import './EditorStyles.css';

interface TiptapEditorProps {
  documentId: string;
  initialContent?: string;
  readOnly?: boolean;
}

export function TiptapEditor({ 
  documentId, 
  initialContent = '', 
  readOnly = false 
}: TiptapEditorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const editorRef = useRef<any>(null);
  const { token } = useAuthStore();
  
  // Yjs setup
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Initialize editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        history: {
          depth: 100,
          newGroupDelay: 500,
        },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-500 underline hover:text-blue-700',
        },
      }),
    ],
    content: initialContent || '<p>Welcome to your document!</p>',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
  });

  // Initialize Yjs
  useEffect(() => {
    if (!editor || !token) return;

    // Create Yjs document
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Create WebSocket provider
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL}/ws/${documentId}?token=${token}`;
    const provider = new WebsocketProvider(
      wsUrl,
      'content',
      ydoc,
      { 
        WebSocketPolyfill: WebSocket,
        params: { token }
      }
    );
    providerRef.current = provider;

    // Get shared text
    const yText = ydoc.getText('content');
    
    // Sync initial content
    if (initialContent) {
      yText.insert(0, initialContent);
    }

    // Create binding between Yjs and TipTap
    // This is simplified - in production use proper binding
    const updateEditor = () => {
      if (editor && yText.toString() !== editor.getHTML()) {
        editor.commands.setContent(yText.toString());
      }
    };

    yText.observe(updateEditor);

    // Handle editor changes
    const handleUpdate = ({ editor: ed }: any) => {
      if (ed && yText.toString() !== ed.getHTML()) {
        // Update Yjs
        yText.delete(0, yText.length);
        yText.insert(0, ed.getHTML());
      }
    };

    editor.on('update', handleUpdate);

    // Handle presence
    provider.on('sync', (isSynced: boolean) => {
      setIsConnected(isSynced);
    });

    // Get active users
    const awareness = provider.awareness;
    awareness.on('change', () => {
      const states = Array.from(awareness.getStates().entries());
      const users = states.map(([clientId, state]) => ({
        clientId,
        ...state.user,
      }));
      setActiveUsers(users);
    });

    // Set user info
    const user = useAuthStore.getState().user;
    awareness.setLocalState({
      user: {
        id: user?.id,
        name: user?.full_name || user?.username,
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
      },
    });

    return () => {
      yText.unobserve(updateEditor);
      editor.off('update', handleUpdate);
      provider.destroy();
      ydoc.destroy();
    };
  }, [documentId, editor, token, initialContent]);

  if (!editor) {
    return <div className="flex justify-center p-8">Loading editor...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg">
      <div className="border-b border-gray-200 bg-gray-50 p-2">
        <div className="flex items-center justify-between">
          <EditorToolbar editor={editor} />
          <div className="flex items-center gap-2">
            <ActiveUsersIndicator users={activeUsers} />
            <ConnectionStatus isConnected={isConnected} />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto p-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

function ActiveUsersIndicator({ users }: { users: any[] }) {
  return (
    <div className="flex items-center -space-x-2">
      {users.slice(0, 5).map((user) => (
        <div
          key={user.clientId}
          className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium"
          style={{ backgroundColor: user.color || '#6366f1' }}
          title={user.name}
        >
          {user.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      ))}
      {users.length > 5 && (
        <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
          +{users.length - 5}
        </div>
      )}
    </div>
  );
}

function ConnectionStatus({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${
          isConnected ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      <span className="text-xs text-gray-500">
        {isConnected ? 'Connected' : 'Reconnecting...'}
      </span>
    </div>
  );
}