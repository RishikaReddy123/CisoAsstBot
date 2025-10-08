import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { FaUserAlt, FaLock } from "react-icons/fa";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("http://localhost:3000/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed!");
        return;
      }

      setToken(data.token);
      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      setError("Something went wrong!");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-100 px-4">
      <form
        onSubmit={handleLogin}
        className="bg-white/90 backdrop-blur-md rounded-3xl shadow-2xl p-10 max-w-md w-full animate-fadeIn"
      >
        <h2 className="text-3xl font-extrabold text-center text-gradient bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 mb-8">
          🔐 Login
        </h2>

        <div className="relative mb-4">
          <FaUserAlt className="absolute top-3 left-3 text-gray-400" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <div className="relative mb-6">
          <FaLock className="absolute top-3 left-3 text-gray-400" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-10 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 rounded-2xl shadow-lg hover:scale-105 hover:shadow-2xl transition-transform font-semibold mb-4"
        >
          Login
        </button>

        {error && (
          <p className="text-red-500 text-sm mt-2 text-center">{error}</p>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          No account?{" "}
          <Link
            to="/signup"
            className="text-blue-600 hover:underline font-medium"
          >
            Sign up
          </Link>
        </p>

        <p className="mt-6 text-center text-xs text-gray-400">
          © 2025 CISO Bot Masarrati. All rights reserved.
        </p>
      </form>
    </div>
  );
};

export default Login;
