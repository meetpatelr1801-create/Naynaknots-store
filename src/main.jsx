import AppErrorBoundary from "./components/AppErrorBoundary";
import React from "react";
import {createRoot} from "react-dom/client";
import App from "./App.jsx";
import "./styles/global.css";
import "./styles/navbar.css";
createRoot(document.getElementById("root")).render(<AppErrorBoundary><App /></AppErrorBoundary>);

const API_BASE =
  import.meta.env.VITE_API_URL || "";

const originalFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  if (
    typeof input === "string" &&
    input.startsWith("/api/")
  ) {
    input = `${API_BASE}${input}`;
  }

  return originalFetch(input, init);
};