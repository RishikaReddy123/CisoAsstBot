import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export default function ChatWindow() {
  const { id } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchConvo() {
      try {
        const res = await fetch(`http://localhost:3000/conversations/${id}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Failed to fetch conversation:", err);
      }
    }
    if (id) fetchConvo();
  }, [id]);

  useEffect(() => {
    if (!wsRef.current) {
      const ws = new WebSocket("ws://localhost:3000/ws");
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "start") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
            },
          ]);
        } else if (msg.type === "chunk") {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { ...last, content: last.content + msg.data },
              ];
            }
            return [
              ...prev,
              {
                role: "assistant",
                content: msg.data,
                timestamp: new Date().toISOString(),
              },
            ];
          });
        } else if (msg.type === "end") {
          console.log("Bot finished");
        } else if (msg.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Bot failed" },
          ]);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    }
  }, [id]);

  async function handleSend() {
    if (!input.trim() || !id) return;
    const token = localStorage.getItem("token") || "";

    try {
      await fetch(`http://localhost:3000/conversations/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: "user", content: input }),
      });

      wsRef.current?.send(
        JSON.stringify({ question: input, token, conversationId: id })
      );

      setMessages((prev) => [
        ...prev,
        { role: "user", content: input, timestamp: new Date().toISOString() },
      ]);
      setInput("");
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100">
      {/* Navbar */}
      <div className="w-full flex justify-between items-center p-4 bg-white/90 backdrop-blur-md shadow-md">
        <h2 className="text-lg font-bold text-blue-800">Conversation</h2>
        <button
          onClick={() => navigate("/ask")}
          className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
        >
          ← Back
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-gray-400 text-center mt-6 italic">
            No messages yet...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`p-4 rounded-2xl max-w-[75%] shadow-md ${
                m.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-br-none"
                  : "bg-white text-gray-900 rounded-bl-none"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <span className="text-xs opacity-70 block mt-1">
                {new Date(m.timestamp || "").toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 flex border-t bg-white/90 backdrop-blur-md shadow-inner">
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 p-3 border rounded-l-2xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSend}
          className="px-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-r-2xl hover:scale-105 hover:shadow-lg transition-transform font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
}
