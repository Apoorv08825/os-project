import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Shield, LogOut, User, ShieldCheck, Activity, KeyRound, Lock, Sun, Moon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logAudit } from "@/lib/audit";

export function AppHeader() {
  const { user, isAdmin, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logAudit("logout");
    await signOut();
    navigate({ to: "/" });
  };

  const navItem = (to: string, label: string, Icon: typeof Shield) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
        {label}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyber shadow-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold tracking-tight">SecureAuth</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Framework v1.0
            </div>
          </div>
        </Link>

        {user ? (
          <nav className="hidden items-center gap-1 md:flex">
            {navItem("/dashboard", "Dashboard", User)}
            {navItem("/mfa", "MFA", KeyRound)}
            {navItem("/resources", "Resources", Lock)}
            {isAdmin && navItem("/admin", "Admin", ShieldCheck)}
            {isAdmin && navItem("/admin/audit", "Audit", Activity)}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="theme-toggle-btn"
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-thumb">
                {theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5 text-cyan-400" />
                ) : (
                  <Sun className="h-3.5 w-3.5 text-amber-500" />
                )}
              </span>
            </span>
          </button>

          {user ? (
            <>
              {isAdmin && <Badge variant="outline" className="border-accent text-accent">ADMIN</Badge>}
              <span className="hidden text-xs text-muted-foreground sm:inline">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
