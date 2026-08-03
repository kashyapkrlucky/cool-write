import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ErrorBoundary } from "./ErrorBoundary";
import { ProtectedRoute } from "./ProtectedRoute";
import PageLoader from "@repo/ui/PageLoader";

const Home = lazy(() => import("../pages/Home"));
const Login = lazy(() => import("../pages/Login"));

// Type for our route configuration
interface RouteConfig {
  path: string;
  element: ReactNode;
  children?: RouteConfig[];
  protected?: boolean;
  guestOnly?: boolean;
}

const routeConfig: RouteConfig[] = [
  {
    path: "/",
    element: <Home />,
    protected: true,
  },
  {
    path: "/login",
    element: <Login />,
    guestOnly: true,
  },
  {
    path: "*",
    element: <Home />,
  },
]

const createRouteElement = (route: RouteConfig) => {
  // Create the element with Suspense and ErrorBoundary
  const element = (
    <Suspense fallback={<PageLoader />}>
      <ErrorBoundary>
        {route.element}
      </ErrorBoundary>
    </Suspense>
  );

  // If the route is protected, wrap it with ProtectedRoute
  if (route.protected) {
    return <ProtectedRoute type="auth">{element}</ProtectedRoute>;
  }

  if (route.guestOnly) {
    return <ProtectedRoute type="guest">{element}</ProtectedRoute>;
  }

  return element;
};

// Create route elements with proper error boundaries and suspense
// Create routes from config with proper nesting
const routes = routeConfig.map(route => {
  if (route.children) {
    return {
      ...route,
      element: createRouteElement(route),
      children: route.children.map(child => ({
        ...child,
        element: createRouteElement(child)
      }))
    };
  }
  return {
    ...route,
    element: createRouteElement(route)
  };
});

const router = createBrowserRouter(routes);

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <RouterProvider router={router} />
    </div>
  );
}

export default App;
