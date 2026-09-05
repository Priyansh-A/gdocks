'use client';

import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
// Remove Link import - it's already in StarterKit
// import Link from '@tiptap/extension-link';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorToolbar } from './EditorToolbar';
import { useAuthStore } from '@/src/store/authStore';
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
  const { token } = useAuthStore();
  
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);

  // Initialize editor - removed duplicate Link extension
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: {
          openOnClick: false,
          HTMLAttributes: {
            class: 'text-blue-500 underline hover:text-blue-700',
          },
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
      // Link extension removed - already in StarterKit
    ],
    content: initialContent || '<p>Welcome to your document!</p>',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    // Add immediatelyRender: true for Next.js hydration
    immediatelyRender: true,
  });

  // Initialize Yjs
  useEffect(() => {
    if (!editor || !token || !documentId) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/ws/${documentId}?token=${token}`;
    
    try {
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

      const yText = ydoc.getText('content');
      
      if (initialContent) {
        yText.insert(0, initialContent);
      }

      const updateEditor = () => {
        if (editor && yText.toString() !== editor.getHTML()) {
          try {
            editor.commands.setContent(yText.toString());
          } catch (e) {
            console.error('Error updating editor from Yjs:', e);
          }
        }
      };

      yText.observe(updateEditor);

      const handleUpdate = ({ editor: ed }: any) => {
        if (!ed) return;
        try {
          const html = ed.getHTML();
          if (html !== yText.toString()) {
            const currentLength = yText.length;
            if (currentLength > 0) {
              yText.delete(0, currentLength);
            }
            yText.insert(0, html);
          }
        } catch (e) {
          console.error('Error updating Yjs from editor:', e);
        }
      };

      editor.on('update', handleUpdate);

      provider.on('sync', (isSynced: boolean) => {
        setIsConnected(isSynced);
      });

      // Handle WebSocket errors
      provider.on('status', ({ status }: any) => {
        console.log('WebSocket connection status:', status);
        setIsConnected(status === 'connected');
      });

      const awareness = provider.awareness;
      awareness.on('change', () => {
        try {
          const states = Array.from(awareness.getStates().entries());
          const users = states.map(([clientId, state]) => ({
            clientId,
            ...state.user,
          }));
          setActiveUsers(users);
        } catch (e) {
          console.error('Error updating active users:', e);
        }
      });

      const user = useAuthStore.getState().user;
      awareness.setLocalState({
        user: {
          id: user?.id,
          name: user?.full_name || user?.username || 'Anonymous',
          color: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
        },
      });

      return () => {
        try {
          yText.unobserve(updateEditor);
          editor.off('update', handleUpdate);
          provider.destroy();
          ydoc.destroy();
        } catch (e) {
          console.error('Error cleaning up Yjs:', e);
        }
      };
    } catch (error) {
      console.error('Error setting up Yjs provider:', error);
      setIsConnected(false);
    }
  }, [documentId, editor, token, initialContent]);

  if (!editor) {
    return (
      <div className="flex justify-center items-center p-8 min-h-125">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
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
  if (users.length === 0) return null;
  
  return (
    <div className="flex items-center -space-x-2">
      {users.slice(0, 5).map((user) => (
        <div
          key={user.clientId || user.id}
          className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium"
          style={{ backgroundColor: user.color || '#6366f1' }}
          title={user.name}
        >
          {user.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      ))}
      {users.length > 5 && (
        <div className="w-7 h-7 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-medium">
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
          isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'
        }`}
      />
      <span className="text-xs text-gray-500">
        {isConnected ? 'Connected' : 'Reconnecting...'}
      </span>
    </div>
  );
}