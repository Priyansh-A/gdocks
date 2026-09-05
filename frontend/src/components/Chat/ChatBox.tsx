'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, X } from 'lucide-react';
import { wsClient } from '@/src/lib/websocket-client';
import { useAuthStore } from '@/src/store/authStore';
import { ChatMessage } from '@/src/types';
interface ChatBoxProps {
  documentId: string;
}

export function ChatBox({ documentId }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Setup WebSocket listeners
  useEffect(() => {
    const handleNewMessage = (data: any) => {
      if (data.type === 'chat_message') {
        setMessages(prev => [...prev, {
          id: data.id || Date.now().toString(),
          user_id: data.user_id,
          username: data.username || 'Unknown',
          content: data.content,
          timestamp: data.timestamp || new Date().toISOString(),
        }]);
      }
    };

    const handleChatHistory = (data: any) => {
      if (data.type === 'chat_history') {
        setMessages(data.data || []);
      }
    };

    wsClient.on('chat_message', handleNewMessage);
    wsClient.on('chat_history', handleChatHistory);

    // Request chat history
    wsClient.send('get_chat_history');

    return () => {
      wsClient.off('chat_message', handleNewMessage);
      wsClient.off('chat_history', handleChatHistory);
    };
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    
    wsClient.send('chat_message', { content: input.trim() });
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    const isCurrentlyTyping = e.target.value.length > 0;
    if (isCurrentlyTyping !== isTyping) {
      setIsTyping(isCurrentlyTyping);
      wsClient.send('typing', { is_typing: isCurrentlyTyping });
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-full shadow-lg hover:bg-blue-600 transition-colors"
      >
        <Send className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-white rounded-lg shadow-2xl flex flex-col border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <h3 className="font-semibold text-gray-700">Chat</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.user_id === user?.id ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-2 ${
                msg.user_id === user?.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {msg.user_id !== user?.id && (
                <div className="text-xs font-semibold mb-1 text-gray-600">
                  {msg.username}
                </div>
              )}
              <div className="text-sm wrap-break">{msg.content}</div>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={handleTyping}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}