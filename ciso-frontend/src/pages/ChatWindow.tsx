import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Paperclip } from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";

type Message = {
  role: "user" | "assistant";
  content: string;
  type?: "file" | "image";
  previewUrl?: string;
};

const ChatWindow = () => {
  const { id: conversationId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token") || "";
  const { ws, sendMessage, isConnected } = useWebSocket();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // ---------------- FETCH EXISTING MESSAGES ----------------
  useEffect(() => {
    if (!conversationId) return;

    fetch(`http://localhost:3000/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setMessages(data.messages || []))
      .catch((err) => console.error("Load failed:", err));
  }, [conversationId, token]);

  // ---------------- STABLE WS LISTENER ----------------
  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // START — create new assistant message
      if (msg.type === "start") {
        setMessages((p) => [...p, { role: "assistant", content: "" }]);
      }

      // STREAM CHUNK
      if (msg.type === "chunk") {
        setMessages((p) => {
          const last = p[p.length - 1];
          if (!last || last.role !== "assistant") {
            return [...p, { role: "assistant", content: msg.data }];
          }
          const updated = { ...last, content: last.content + msg.data };
          return [...p.slice(0, -1), updated];
        });
      }

      // END — store final assistant message
      if (msg.type === "end") {
        const last = messagesRef.current[messagesRef.current.length - 1];
        if (last?.role === "assistant") {
          fetch(`http://localhost:3000/conversations/${conversationId}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(last),
          });
        }
      }

      // ERROR
      if (msg.type === "error") {
        setMessages((p) => [
          ...p,
          { role: "assistant", content: "❌ Bot failed" },
        ]);
      }
    };
  }, [ws, token, conversationId]);

  // Keep a ref to messages so ws.onmessage always has latest value
  const messagesRef = useRef<Message[]>([]);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // ---------------- SEND MESSAGE ----------------
  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;

    let fileUrl = null;

    // UPLOAD FILE
    if (uploadedFile) {
      const form = new FormData();
      form.append("file", uploadedFile);
      const r = await fetch("http://localhost:3000/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await r.json();
      fileUrl = data.url;
    }

    // SHOW USER MESSAGE
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input || `(Uploaded ${uploadedFile?.name})` },
    ]);

    // SAVE TO DB
    await fetch(`http://localhost:3000/conversations/${conversationId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ role: "user", content: input }),
    });

    // WS SEND
    const payload = {
      question: JSON.stringify({ text: input, fileUrl }),
      token,
      conversationId,
    };

    const trySend = () => {
      if (isConnected) sendMessage(JSON.stringify(payload));
      else setTimeout(trySend, 500);
    };
    trySend();

    // RESET
    setInput("");
    setUploadedFile(null);
  };

  // ---------------- FILE UPLOAD PREVIEW ----------------
  const handleFileUpload = (e: any) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setUploadedFile(f);

    const preview = URL.createObjectURL(f);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: f.name,
        previewUrl: preview,
        type: f.type.startsWith("image") ? "image" : "file",
      },
    ]);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* --- TOP NAVBAR WITH BACK BUTTON --- */}
      <div className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md">
        <h2 className="text-xl font-bold">CISO Assistant Bot</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300 transition"
        >
          ← Back
        </button>
      </div>

      {/* --- CHAT AREA --- */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`p-3 rounded max-w-[80%] ${
              m.role === "user" ? "self-end bg-blue-100" : "self-start bg-white"
            }`}
          >
            {m.previewUrl && m.type === "image" && (
              <img src={m.previewUrl} className="max-h-40 mb-2 rounded" />
            )}
            {m.previewUrl && m.type === "file" && (
              <a
                href={m.previewUrl}
                target="_blank"
                className="text-blue-600 underline"
              >
                📎 {m.content}
              </a>
            )}

            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      {/* --- INPUT AREA --- */}
      <div className="p-4 border-t flex space-x-2">
        <input
          type="file"
          id="file-x"
          className="hidden"
          accept="image/*,.pdf"
          onChange={handleFileUpload}
        />
        <label htmlFor="file-x" className="cursor-pointer p-2 border rounded">
          <Paperclip />
        </label>

        <input
          className="flex-1 border rounded p-2"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
        />

        <button
          onClick={handleSendMessage}
          className="px-4 bg-blue-500 text-white rounded"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;
