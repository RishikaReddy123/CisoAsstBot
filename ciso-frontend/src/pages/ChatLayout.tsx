import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

interface Conversation {
  _id: string;
  title: string;
  messages?: { content: string; timestamp: string }[];
}

function Sidebar() {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const location = useLocation();

  useEffect(() => {
    async function fetchConvos() {
      const res = await fetch("http://localhost:3000/conversations", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      setConvos(data);
    }
    fetchConvos();
  }, [location]);

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-indigo-100 via-blue-50 to-purple-100 shadow-xl">
      <h2 className="text-xl font-bold p-4 border-b border-gray-300 text-blue-800">
        Conversations
      </h2>
      <ul className="flex-1 overflow-y-auto divide-y divide-gray-200">
        {convos.length === 0 && (
          <p className="p-4 text-gray-500 text-sm italic">
            No conversations yet...
          </p>
        )}
        {convos.map((c) => {
          const lastMessage = c.messages?.[c.messages.length - 1];
          const isActive = location.pathname === `/conversations/${c._id}`;

          return (
            <li key={c._id} className="p-2">
              <Link
                to={`/conversations/${c._id}`}
                className={`block p-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                    : "bg-white hover:bg-gray-50 text-gray-800"
                }`}
              >
                <div className="font-semibold truncate">
                  {c.title ||
                    c.messages?.[0]?.content?.slice(0, 20) ||
                    "Untitled"}
                </div>
                {lastMessage && (
                  <div
                    className={`text-sm truncate mt-1 ${
                      isActive ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {lastMessage.content}
                  </div>
                )}
                {lastMessage && (
                  <div
                    className={`text-xs mt-0.5 text-right ${
                      isActive ? "text-blue-200" : "text-gray-400"
                    }`}
                  >
                    {new Date(lastMessage.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function ChatLayout() {
  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100">
      {/* Sidebar */}
      <div className="w-72 border-r border-gray-200 shadow-lg">
        <Sidebar />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 bg-white shadow-inner rounded-tl-2xl overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
