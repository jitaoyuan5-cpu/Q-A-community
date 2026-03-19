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
import { RequireAuth } from "./components/auth/require-auth";

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
      { path: "question/:id", Component: QuestionDetailPage },
      { path: "ask", Component: AskProtected },
      { path: "search", Component: SearchPage },
      { path: "login", Component: LoginPage },
      { path: "register", Component: RegisterPage },
      { path: "profile/:id", Component: ProfilePage },
      { path: "profile/edit", Component: ProfileEditProtected },
      { path: "*", Component: NotFoundPage },
    ],
  },
];

export const router = createBrowserRouter(routeObjects);
