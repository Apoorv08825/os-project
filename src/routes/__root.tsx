import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { AppHeader } from "@/components/AppHeader";
import { AnimatedBackground } from "@/components/AnimatedBackground";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-cyber">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Access denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The resource you're looking for does not exist on this secure system.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Return to home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="relative min-h-screen">
          {/* Animated background layer */}
          <AnimatedBackground />
          {/* Content layer — sits above the canvas */}
          <div className="relative z-10 min-h-screen">
            <AppHeader />
            <Outlet />
            <Toaster richColors position="top-right" />
          </div>
        </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
