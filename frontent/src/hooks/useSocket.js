import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

// Socket.io URL - Set VITE_SOCKET_URL in .env file or use default server URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "https://work-spot-1.onrender.com";

export const useSocket = (onConnect, onDisconnect, eventHandlers = {}) => {
  const socketRef = useRef(null);
  const onConnectRef = useRef(onConnect);
  const onDisconnectRef = useRef(onDisconnect);
  const handlersRef = useRef(eventHandlers);

  // Update refs when callbacks change
  useEffect(() => {
    onConnectRef.current = onConnect;
    onDisconnectRef.current = onDisconnect;
    handlersRef.current = eventHandlers;
  }, [onConnect, onDisconnect, eventHandlers]);

  // Create socket connection only once
  useEffect(() => {
    if (!socketRef.current) {
      console.log('🔌 Creating Socket.io connection...');
      socketRef.current = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      });

      const socket = socketRef.current;

      // Connection events
      socket.on('connect', () => {
        console.log('✅ Socket.io connected:', socket.id);
        if (onConnectRef.current) onConnectRef.current();
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket.io disconnected');
        if (onDisconnectRef.current) onDisconnectRef.current();
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Socket.io connection error:', error);
      });
    }

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        console.log('🔌 Disconnecting Socket.io...');
        socketRef.current.off('connect');
        socketRef.current.off('disconnect');
        socketRef.current.off('connect_error');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Only run once on mount

  // Register event handlers once, using refs so they always have latest handlers
  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Register handlers that use refs to get latest versions
    Object.entries(handlersRef.current).forEach(([event, handler]) => {
      // Remove old listener if exists
      socket.off(event);
      // Add new listener that uses the ref
      socket.on(event, (data) => {
        // Get the latest handler from ref
        const latestHandler = handlersRef.current[event];
        if (latestHandler) {
          latestHandler(data);
        }
      });
      console.log(`📡 Registered Socket.io listener: ${event}`);
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        Object.keys(handlersRef.current).forEach((event) => {
          socketRef.current.off(event);
        });
      }
    };
  }, []); // Only run once - handlers are accessed via ref

  return socketRef.current;
};

export default useSocket;

