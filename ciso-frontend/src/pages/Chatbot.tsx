import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Paperclip } from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";

type Message = {
  role: "user" | "assistant";
  content: string;
  // <<< ADDED: optional file preview fields
  type?: "image" | "file";
  previewUrl?: string;
};

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { ws, sendMessage, isConnected } = useWebSocket();

  const navigate = useNavigate();

  // -------------------- WebSocket setup --------------------
  useEffect(() => {
    if (!ws) return;

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      handleWsMessage(msg);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws]);

  // -------------------- Handle incoming WS messages --------------------
  const handleWsMessage = (msg: any) => {
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
      // Optionally, save assistant message to backend conversation
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "assistant" && conversationId) {
        const token = localStorage.getItem("token") || "";
        fetch(`http://localhost:3000/conversations/${conversationId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            role: "assistant",
            content: lastMessage.content,
          }),
        });
      }
    } else if (msg.type === "error") {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Bot failed" },
      ]);
    }
  };

  // -------------------- Send message --------------------
  const handleSendMessage = async () => {
    if (!input.trim() && !uploadedFile) return;
    const token = localStorage.getItem("token") || "";
    let convoId = conversationId;

    try {
      // 1️⃣ Create conversation if it doesn’t exist
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
      }

      // 2️⃣ Upload file if exists
      let fileUrl: string | null = null;
      if (uploadedFile) {
        const formData = new FormData();
        formData.append("file", uploadedFile);
        const uploadRes = await fetch("http://localhost:3000/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const data = await uploadRes.json();
        fileUrl = data.url;
      }

      // 3️⃣ Add user message locally
      // If there's a file preview we already added a preview message at upload time,
      // keep a clean textual user message in the chat feed like before.
      setMessages((prev) => [
        ...prev,
        { role: "user", content: input || `(Uploaded ${uploadedFile?.name})` },
      ]);

      // 4️⃣ Save user message to backend conversation
      await fetch(`http://localhost:3000/conversations/${convoId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: "user", content: input }),
      });

      // 5️⃣ Send message via WebSocket (with retry if not connected yet)
      const wsPayload = {
        question: JSON.stringify({ text: input, fileUrl }),
        token,
        conversationId: convoId,
      };

      const sendWhenReady = () => {
        if (isConnected) {
          sendMessage(JSON.stringify(wsPayload));
        } else {
          console.warn("WebSocket not connected yet. Retrying in 1s...");
          setTimeout(sendWhenReady, 1000);
        }
      };

      sendWhenReady();

      // 6️⃣ Reset input & file
      // <<< ADDED: revoke preview URL to free memory (if any) and clear file
      if (uploadedFile && (uploadedFile as any).__previewUrl) {
        try {
          URL.revokeObjectURL((uploadedFile as any).__previewUrl);
        } catch (e) {
          // ignore
        }
      }
      setInput("");
      setUploadedFile(null);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // <<< ADDED: Type-safe file upload handling + immediate preview insertion
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    setUploadedFile(file);

    // Create a blob preview URL and attach to message
    const previewUrl = URL.createObjectURL(file);
    // also attach the preview url to the file object so we can revoke it later
    try {
      (file as any).__previewUrl = previewUrl;
    } catch (err) {
      // ignore if not writable
    }

    const msg: Message = file.type.startsWith("image/")
      ? { role: "user", content: file.name, type: "image", previewUrl }
      : { role: "user", content: file.name, type: "file", previewUrl };

    // Insert the preview message immediately (so user sees the upload)
    setMessages((prev) => [...prev, msg]);
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
            {/* <<< ADDED: Render preview if message has a previewUrl */}
            {m.previewUrl ? (
              m.type === "image" ? (
                <div className="mb-2">
                  <img
                    src={m.previewUrl}
                    alt={m.content}
                    className="rounded-md max-h-48 object-cover mb-2"
                  />
                  <div className="text-xs text-gray-600">{m.content}</div>
                </div>
              ) : (
                <div className="mb-2">
                  <a
                    href={m.previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline"
                  >
                    📎 {m.content}
                  </a>
                </div>
              )
            ) : null}

            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white/90 backdrop-blur-md shadow-inner">
        <div className="flex items-center gap-3">
          {/* Upload Button */}
          <input
            id="file-upload"
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileUpload} // <<< ADDED: use new handler
            className="hidden"
          />
          <label
            htmlFor="file-upload"
            className="flex items-center justify-center w-10 h-10 rounded-full border border-blue-400 text-blue-600 bg-blue-50 hover:bg-blue-100 cursor-pointer transition-all hover:scale-105 shadow-sm hover:shadow-md"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4" />
          </label>

          {/* Text Input */}
          <input
            type="text"
            placeholder="Ask something..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 p-3 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            className="px-6 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-2xl hover:scale-105 hover:shadow-lg transition-transform font-semibold"
          >
            Send
          </button>
        </div>

        {/* Uploaded File Preview (local control + remove) */}
        {uploadedFile && (
          <div className="flex items-center justify-between mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
            <span className="text-sm text-blue-700 font-medium truncate max-w-[70%]">
              📄 {uploadedFile.name}
            </span>
            <button
              onClick={() => {
                // revoke blob URL if set on the file and cleanup
                if ((uploadedFile as any).__previewUrl) {
                  try {
                    URL.revokeObjectURL((uploadedFile as any).__previewUrl);
                  } catch (e) {}
                }
                setUploadedFile(null);
              }}
              className="text-xs text-red-500 hover:text-red-700 font-semibold transition"
            >
              ✕ Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;
