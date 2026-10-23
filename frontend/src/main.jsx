import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/source-sans-3/wght.css";
import App from "./App.jsx";
import { phonePrototypeEnabled } from "./phonePrototype.js";
import "./phonePrototype.css";

if (phonePrototypeEnabled(import.meta.env.DEV, window.location.search, window.screen.width, window.screen.height)) {
  document.documentElement.dataset.phonePreview = "true";
  document.querySelector('meta[name="viewport"]').content =
    "width=device-width, initial-scale=1.0, viewport-fit=cover, interactive-widget=resizes-content";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
