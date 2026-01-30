import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { WebSocketProvider } from "./context/WebSocketContext";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WebSocketProvider>
      <App />
    </WebSocketProvider>
  </StrictMode>
);
