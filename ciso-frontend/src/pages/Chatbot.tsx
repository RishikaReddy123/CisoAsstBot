import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

const Chatbot = () => {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const navigate = useNavigate();

  const initWebSocket = (question: string, token: string, convoId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      const ws = new WebSocket("ws://localhost:3000/ws");
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ question, token, conversationId: convoId }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "start") {
          setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        } else if (msg.type === "chunk") {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [
                ...prev.slice(0, -1),
                { role: "assistant", content: last.content + msg.data },
              ];
            }
            return [...prev, { role: "assistant", content: msg.data }];
          });
        } else if (msg.type === "end") {
          const lastMessage = messages[messages.length - 1];
          if (lastMessage?.role === "assistant") {
            fetch(`http://localhost:3000/conversations/${convoId}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(lastMessage),
            });
          }
        } else if (msg.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: "Bot failed" },
          ]);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Connection error" },
        ]);
      };

      ws.onclose = () => {
        wsRef.current = null;
      };
    } else {
      wsRef.current.send(
        JSON.stringify({ question, token, conversationId: convoId })
      );
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const token = localStorage.getItem("token") || "";

    try {
      let convoId = conversationId;

      if (!convoId) {
        const res = await fetch("http://localhost:3000/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ firstMessage: input }),
        });
        const newConvo = await res.json();
        convoId = newConvo._id;
        setConversationId(convoId);
      } else {
        await fetch(`http://localhost:3000/conversations/${convoId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: "user", content: input }),
        });
      }

      setMessages((prev) => [...prev, { role: "user", content: input }]);
      initWebSocket(input, token, convoId!);
      setInput("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100"
      style={{ paddingTop: "var(--navbar-height)" }}
    >
      {/* Navbar */}
      <div className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md">
        <h2 className="text-xl font-bold">CISO Assistant Bot</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition"
        >
          ← Back
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center mt-4">
            Chat messages will appear here...
          </p>
        )}
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg max-w-[80%] break-words ${
              m.role === "user"
                ? "bg-blue-100 self-end text-right"
                : "bg-white shadow-md self-start text-left"
            }`}
          >
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 flex border-t bg-white/90 backdrop-blur-md shadow-inner">
        <input
          type="text"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          className="flex-1 p-3 border rounded-l-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
        />
        <button
          onClick={sendMessage}
          className="px-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-r-2xl hover:scale-105 hover:shadow-lg transition-transform font-semibold"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default Chatbot;
