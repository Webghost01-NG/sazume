import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import Docs from "./Docs.js";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {window.location.pathname.startsWith("/docs") ? <Docs /> : <App />}
  </React.StrictMode>,
);
