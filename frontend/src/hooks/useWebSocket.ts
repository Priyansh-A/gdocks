'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { wsClient } from '@/src/lib/websocket-client';
import { useAuthStore } from '@/src/store/authStore';

interface UseWebSocketReturn {
  isConnected: boolean;
  sendMessage: (type: string, data?: any) => void;
  onMessage: (type: string, handler: (data: any) => void) => void;
  offMessage: (type: string, handler: (data: any) => void) => void;
  connect: (documentId: string) => Promise<void>;
  disconnect: () => void;
}

export function useWebSocket(documentId?: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const { token } = useAuthStore();
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Connect to WebSocket
  const connect = useCallback(async (docId: string) => {
    if (!token) {
      console.error('No token available for WebSocket connection');
      return;
    }

    try {
      await wsClient.connect(docId, token);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  }, [token]);

  // Disconnect
  const disconnect = useCallback(() => {
    wsClient.disconnect();
    setIsConnected(false);
  }, []);

  // Send message
  const sendMessage = useCallback((type: string, data?: any) => {
    wsClient.send(type, data);
  }, []);

  // Register message handler
  const onMessage = useCallback((type: string, handler: (data: any) => void) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    wsClient.on(type, handler);
  }, []);

  // Unregister message handler
  const offMessage = useCallback((type: string, handler: (data: any) => void) => {
    const handlers = handlersRef.current.get(type);
    if (handlers) {
      handlers.delete(handler);
      wsClient.off(type, handler);
    }
  }, []);

  // Auto-connect when documentId changes
  useEffect(() => {
    if (documentId && token) {
      connect(documentId);
    }

    return () => {
      disconnect();
    };
  }, [documentId, token, connect, disconnect]);

  return {
    isConnected,
    sendMessage,
    onMessage,
    offMessage,
    connect,
    disconnect,
  };
}