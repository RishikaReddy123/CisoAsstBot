import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import Login from "./pages/Login.tsx";
import Signup from "./pages/Signup.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Chatbot from "./pages/Chatbot.tsx";
import PrivateRoute from "./components/PrivateRoute.tsx";
import Navbar from "./components/Navbar.tsx";
import ChatLayout from "./pages/ChatLayout.tsx";
import ChatWindow from "./pages/ChatWindow.tsx";

function App() {
  return (
    <>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<PrivateRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route element={<ChatLayout />}>
              <Route path="/ask" element={<Chatbot />} />
              <Route path="/conversations" element={<div>Select a chat</div>} />
              <Route path="/conversations/:id" element={<ChatWindow />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
