import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routeObjects } from "../../src/app/routes";
import { QAProvider } from "../../src/app/store/qa-context";
import { AuthProvider } from "../../src/app/auth-context";

const TEST_AUTH_STORAGE_KEY = "qa_test_auth_user";
const defaultTestUser = {
  id: 1,
  email: "alice@example.com",
  name: "张三",
  avatar: "https://i.pravatar.cc/80?img=1",
  reputation: 2850,
};

export const renderAppAt = (path: string, options: { authenticated?: boolean } = {}) => {
  const { authenticated = true } = options;
  localStorage.setItem(TEST_AUTH_STORAGE_KEY, authenticated ? JSON.stringify(defaultTestUser) : "null");
  const router = createMemoryRouter(routeObjects, { initialEntries: [path] });
  return render(
    <AuthProvider>
      <QAProvider>
        <RouterProvider router={router} />
      </QAProvider>
    </AuthProvider>,
  );
};
