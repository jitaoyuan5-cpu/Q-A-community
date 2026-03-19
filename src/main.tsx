import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/routes";
import { QAProvider } from "./app/store/qa-context";
import { AuthProvider } from "./app/auth-context";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <QAProvider>
        <RouterProvider router={router} />
      </QAProvider>
    </AuthProvider>
  </StrictMode>,
);
