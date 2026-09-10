'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { EditorToolbar } from './EditorToolbar';
import { PDFViewer } from './PDFViewer';
import { MediaViewer } from './MediaViewer';
import { useAuthStore } from '@/src/store/authStore';
import './EditorStyles.css';

export type DocumentType = 'document' | 'pdf' | 'media';

interface TiptapEditorProps {
  documentId: string;
  documentType?: DocumentType;
  initialContent?: string;
  fileUrl?: string | null;
  fileMetadata?: Record<string, any> | null;
  readOnly?: boolean;
}

export function TiptapEditor(props: TiptapEditorProps) {
  const { documentType = 'document', fileUrl } = props;

  if (documentType === 'pdf' && fileUrl) {
    return (
      <PDFViewer
        url={fileUrl}
        title={props.fileMetadata?.originalName || 'PDF Document'}
        readOnly={props.readOnly}
      />
    );
  }

  if (documentType === 'media' && fileUrl) {
    return (
      <MediaViewer
        url={fileUrl}
        title={props.fileMetadata?.originalName || 'Media'}
        mimeType={props.fileMetadata?.mimeType || 'application/octet-stream'}
        readOnly={props.readOnly}
      />
    );
  }

  return <RichTextEditor {...props} />;
}

function RichTextEditor({
  documentId,
  initialContent = '',
  readOnly = false,
}: TiptapEditorProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const { token } = useAuthStore();

  const hasSeededRef = useRef(false);

  const ydoc = useMemo(() => new Y.Doc(), []);

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
      Collaboration.configure({
        document: ydoc,
        field: 'content',
      }),
    ],
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    immediatelyRender: false,
  });

  useEffect(() => {
    if (!editor || !token || !documentId) return;

    const wsBaseUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'}/yws`;

    let provider: WebsocketProvider | null = null;
    try {
      provider = new WebsocketProvider(wsBaseUrl, documentId, ydoc, {
        WebSocketPolyfill: WebSocket,
        params: { token },
      });
    } catch (error) {
      console.error('Error setting up Yjs provider:', error);
      setIsConnected(false);
    }

    if (!provider) return;

    provider.on('sync', (isSynced: boolean) => {
      setIsConnected(isSynced);

      if (isSynced && !hasSeededRef.current) {
        hasSeededRef.current = true;
        const fragment = ydoc.getXmlFragment('content');
        const isSharedEmpty = fragment.length === 0;
        if (isSharedEmpty && isSeeddableHtml(initialContent)) {
          editor.commands.setContent(initialContent);
        }
      }
    });

    provider.on('status', ({ status }: any) => {
      setIsConnected(status === 'connected');
    });

    const awareness = provider.awareness;
    const syncAwareness = () => {
      try {
        const states = Array.from(awareness.getStates().entries());
        const users = states
          .map(([clientId, state]) => ({ clientId, ...state.user }))
          .filter((u) => u && (u.id || u.name));
        setActiveUsers(users);
      } catch (error) {
        console.error('Error updating active users:', error);
      }
    };

    awareness.on('change', syncAwareness);
    syncAwareness();

    const user = useAuthStore.getState().user;
    awareness.setLocalStateField('user', {
      id: user?.id,
      name: user?.full_name || user?.username || 'Anonymous',
      color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    });

    return () => {
      try {
        awareness.off('change', syncAwareness);
        provider?.destroy();
        ydoc.destroy();
      } catch (error) {
        console.error('Error cleaning up Yjs:', error);
      }
    };
  }, [documentId, editor, token, ydoc, initialContent]);

  if (!editor) {
    return (
      <div className="flex justify-center items-center p-8 min-h-[500px]">
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

function isSeeddableHtml(value: string): boolean {
  if (!value || !value.trim()) return false;
  const trimmed = value.trim();
  // Persisted Yjs snapshots are JSON like {"snapshot":"...","version":N}
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  return /^<[a-z!]/.test(trimmed);
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