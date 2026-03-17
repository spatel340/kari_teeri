import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { GameSessionProvider } from "@/hooks/useGameSession";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GameSessionProvider>
        <App />
      </GameSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
