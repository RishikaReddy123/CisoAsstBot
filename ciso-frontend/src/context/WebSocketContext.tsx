import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type WebSocketContextType = {
  ws: WebSocket | null;
  sendMessage: (message: string) => void;
  isConnected: boolean;
};

const WebSocketContext = createContext<WebSocketContextType>({
  ws: null,
  sendMessage: () => {},
  isConnected: false,
});

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    //const socket = new WebSocket("ws://localhost:3000/ws");

    const socket = new WebSocket(
      `${window.location.protocol === "https:" ? "wss" : "ws"}://${
        window.location.hostname
      }:3000/ws`
    );

    socket.onopen = () => {
      console.log("🌐 WebSocket connected");
      setIsConnected(true);
    };

    socket.onclose = () => {
      console.log("❌ WebSocket closed, retrying in 3s...");
      setIsConnected(false);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = (err) => {
      console.error("⚠️ WebSocket error:", err);
      socket.close();
    };

    wsRef.current = socket;
  };

  const sendMessage = (message: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(message);
    } else {
      console.warn("WebSocket not connected. Cannot send message.");
    }
  };

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, []);

  return (
    <WebSocketContext.Provider
      value={{ ws: wsRef.current, sendMessage, isConnected }}
    >
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => useContext(WebSocketContext);
