import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { router } from "./app/routes";
import { QAProvider } from "./app/store/qa-context";
import { AuthProvider } from "./app/auth-context";
import { I18nProvider } from "./app/i18n";
import { registerServiceWorker } from "./app/pwa";
import "./styles/index.css";

registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <I18nProvider>
        <QAProvider>
          <RouterProvider router={router} />
        </QAProvider>
      </I18nProvider>
    </AuthProvider>
  </StrictMode>,
);
