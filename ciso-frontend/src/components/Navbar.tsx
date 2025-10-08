import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";

const Navbar = () => {
  const token = useAuthStore((s) => s.token);
  const setToken = useAuthStore((s) => s.setToken);
  const navigate = useNavigate();

  return (
    <header className="bg-white shadow-md px-6 py-4 flex justify-between items-center">
      <h1
        onClick={() => navigate("/ask")}
        className="text-xl font-bold text-blue-700 cursor-pointer"
      >
        CISO Bot Masarrati
      </h1>

      <nav className="flex gap-6 items-center">
        {!token ? (
          <>
            <Link
              to="/login"
              className="text-gray-700 hover:text-blue-600 font-medium"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="text-gray-700 hover:text-blue-600 font-medium"
            >
              Signup
            </Link>
          </>
        ) : (
          <>
            <button
              onClick={() => {
                setToken(null);
                navigate("/login");
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Logout
            </button>
          </>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
