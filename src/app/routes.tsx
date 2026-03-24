import { createBrowserRouter } from "react-router";
import { RootLayout } from "./pages/root-layout";
import { HomePage } from "./pages/home-page";
import { QuestionsPage } from "./pages/questions-page";
import { HotTopicsPage } from "./pages/hot-topics-page";
import { RemotePage } from "./pages/remote-page";
import { ArticlesPage } from "./pages/articles-page";
import { ArticleDetailPage } from "./pages/article-detail-page";
import { FollowingPage } from "./pages/following-page";
import { AskPage } from "./pages/ask-page";
import { QuestionDetailPage } from "./pages/question-detail-page";
import { NotFoundPage } from "./pages/not-found-page";
import { LoginPage } from "./pages/login-page";
import { RegisterPage } from "./pages/register-page";
import { SearchPage } from "./pages/search-page";
import { ProfilePage } from "./pages/profile-page";
import { ProfileEditPage } from "./pages/profile-edit-page";
import { FavoritesPage } from "./pages/favorites-page";
import { NotificationsPage } from "./pages/notifications-page";
import { AdminReportsPage } from "./pages/admin-reports-page";
import { AdminTutorialsPage } from "./pages/admin-tutorials-page";
import { AssistantPage } from "./pages/assistant-page";
import { TutorialDetailPage } from "./pages/tutorial-detail-page";
import { TutorialsPage } from "./pages/tutorials-page";
import { PlaygroundPage } from "./pages/playground-page";
import { DevelopersPage } from "./pages/developers-page";
import { DeveloperKeysPage } from "./pages/developer-keys-page";
import { DeveloperDocsPage } from "./pages/developer-docs-page";
import { RequireAdmin, RequireAuth } from "./components/auth/require-auth";

function AskProtected() {
  return (
    <RequireAuth>
      <AskPage />
    </RequireAuth>
  );
}

function FollowingProtected() {
  return (
    <RequireAuth>
      <FollowingPage />
    </RequireAuth>
  );
}

function ProfileEditProtected() {
  return (
    <RequireAuth>
      <ProfileEditPage />
    </RequireAuth>
  );
}

function FavoritesProtected() {
  return (
    <RequireAuth>
      <FavoritesPage />
    </RequireAuth>
  );
}

function NotificationsProtected() {
  return (
    <RequireAuth>
      <NotificationsPage />
    </RequireAuth>
  );
}

function AdminProtected() {
  return (
    <RequireAdmin>
      <AdminReportsPage />
    </RequireAdmin>
  );
}

function AdminTutorialsProtected() {
  return (
    <RequireAdmin>
      <AdminTutorialsPage />
    </RequireAdmin>
  );
}

function AssistantProtected() {
  return (
    <RequireAuth>
      <AssistantPage />
    </RequireAuth>
  );
}

function DeveloperKeysProtected() {
  return (
    <RequireAuth>
      <DeveloperKeysPage />
    </RequireAuth>
  );
}

export const routeObjects = [
  {
    path: "/",
    Component: RootLayout,
    children: [
      { index: true, Component: HomePage },
      { path: "hot", Component: HotTopicsPage },
      { path: "remote", Component: RemotePage },
      { path: "articles", Component: ArticlesPage },
      { path: "articles/:id", Component: ArticleDetailPage },
      { path: "questions", Component: QuestionsPage },
      { path: "following", Component: FollowingProtected },
      { path: "favorites", Component: FavoritesProtected },
      { path: "question/:id", Component: QuestionDetailPage },
      { path: "ask", Component: AskProtected },
      { path: "assistant", Component: AssistantProtected },
      { path: "tutorials", Component: TutorialsPage },
      { path: "tutorials/:id", Component: TutorialDetailPage },
      { path: "playground", Component: PlaygroundPage },
      { path: "developers", Component: DevelopersPage },
      { path: "developers/keys", Component: DeveloperKeysProtected },
      { path: "developers/docs", Component: DeveloperDocsPage },
      { path: "search", Component: SearchPage },
      { path: "notifications", Component: NotificationsProtected },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegisterPage },
      { path: "profile/:id", Component: ProfilePage },
      { path: "profile/edit", Component: ProfileEditProtected },
      { path: "admin/reports", Component: AdminProtected },
      { path: "admin/tutorials", Component: AdminTutorialsProtected },
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routeObjects);
