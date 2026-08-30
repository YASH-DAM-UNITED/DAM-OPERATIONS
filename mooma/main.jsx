import React from "react";
import ReactDOM from "react-dom/client";
import MoomaPortal from "./MoomaPortal.jsx";

ReactDOM.createRoot(document.getElementById("mooma-root")).render(
  <React.StrictMode>
    <MoomaPortal
      onBack={() => {
        window.location.href = "/";
      }}
    />
  </React.StrictMode>
);
