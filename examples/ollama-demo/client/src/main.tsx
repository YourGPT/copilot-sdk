import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

import "@yourgpt/copilot-sdk/ui/styles.css";
import "@yourgpt/copilot-sdk/ui/themes/modern-minimal.css";
import "./App.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
