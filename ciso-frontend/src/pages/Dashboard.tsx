import { useNavigate } from "react-router-dom";
import { FaRobot } from "react-icons/fa";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100 relative px-4 pt-20 pb-10">
      {/* Hero Section */}
      <main className="mx-auto text-center bg-white/90 backdrop-blur-md rounded-2xl shadow-lg p-6 mb-8 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
          🚀 Welcome to CISO Bot Masarrati
        </h1>
        <p className="text-sm md:text-base text-gray-700 mb-4 leading-relaxed">
          Chat with our{" "}
          <span className="font-semibold text-blue-600">
            AI-powered assistant
          </span>{" "}
          to get instant insights. Ask about{" "}
          <span className="font-semibold text-purple-600">
            employee profiles, risks, vulnerabilities
          </span>
          , and more.
        </p>
        <button
          onClick={() => navigate("/ask")}
          className="inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-sm md:text-base font-semibold rounded-xl shadow hover:scale-105 hover:shadow-lg transition-transform duration-300"
        >
          💬 Start Chatting with AI
        </button>
      </main>

      {/* Features Section */}
      <section className="grid grid-cols-1 gap-6 max-w-2xl w-full mx-auto">
        <div
          className="flex flex-col items-center bg-white rounded-xl shadow p-4 hover:scale-105 hover:shadow-lg transition-transform duration-300 cursor-pointer"
          onClick={() => navigate("/ask")}
        >
          <FaRobot className="text-blue-500 text-4xl md:text-5xl mb-2 animate-bounce" />
          <h3 className="text-lg font-bold mb-1">AI Assistance</h3>
          <p className="text-gray-600 text-center text-sm">
            Get instant answers to your security queries and employee insights.
          </p>
        </div>
      </section>

      {/* Floating Decorations */}
      <div className="absolute top-10 left-6 w-20 h-20 bg-blue-200/50 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-16 right-8 w-28 h-28 bg-purple-200/50 rounded-full blur-3xl animate-pulse"></div>
    </div>
  );
};

export default Dashboard;
