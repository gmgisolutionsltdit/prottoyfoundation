import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LogOut, ShieldCheck, Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommandPalette } from "@/components/CommandPalette";
import { navItems } from "@/lib/navItems";

const SIDEBAR_COLLAPSED_KEY = "pf-sidebar-collapsed";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  );

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { isSuperAdmin } = useAuth();
  const { confirmLeave, setDirty } = useUnsavedChanges();
  const navigate = useNavigate();

  // An unsaved entry form is open — confirm before discarding it via nav click.
  const guardedNavigate = (to: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirmLeave()) return;
    setDirty(false);
    onNavigate?.();
    navigate(to);
  };

  return (
    <nav className="flex-1 space-y-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={guardedNavigate(item.to)}>
            <Icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        );
      })}
      {isSuperAdmin && (
        <NavLink to="/users" className={linkClass} onClick={guardedNavigate("/users")}>
          <ShieldCheck className="h-4 w-4" />
          Users
        </NavLink>
      )}
    </nav>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  // Each page renders its own AppLayout, so navigating remounts this component
  // — the collapsed choice has to be persisted to survive a page change.
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggleDesktopSidebar = () =>
    setDesktopCollapsed((collapsed) => {
      const next = !collapsed;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // A blocked/unavailable localStorage just means the choice won't stick.
      }
      return next;
    });

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  const brand = (
    <div className="border-b p-4 flex items-center gap-3">
      <img src="/logo.png" alt="Prottoy Foundation" className="h-10 w-10 rounded-full" />
      <div>
        <h1 className="text-sm font-semibold leading-tight">Prottoy Foundation</h1>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t p-3">
      <p className="mb-2 truncate px-3 text-xs text-muted-foreground">
        {(user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? user?.email}
      </p>
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {!desktopCollapsed && (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
          {brand}
          <SidebarNav />
          {footer}
        </aside>
      )}

      <main className="min-w-0 flex-1 overflow-auto">
        <div className="hidden items-center gap-2 border-b bg-card p-2 md:flex">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDesktopSidebar}
            aria-label={desktopCollapsed ? "Show navigation menu" : "Hide navigation menu"}
            title={desktopCollapsed ? "Show menu" : "Hide menu"}
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </Button>
          {desktopCollapsed && (
            <>
              <img src="/logo.png" alt="Prottoy Foundation" className="h-7 w-7 rounded-full" />
              <h1 className="font-semibold">Prottoy Foundation</h1>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2 text-muted-foreground"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="h-4 w-4" />
            Search
            <kbd className="pointer-events-none ml-2 hidden select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium lg:inline-flex">
              ⌘K
            </kbd>
          </Button>
        </div>

        <div className="md:hidden flex items-center justify-between border-b bg-card p-3">
          <div className="flex items-center gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex h-full flex-col">
                  {brand}
                  <SidebarNav onNavigate={() => setMobileOpen(false)} />
                  {footer}
                </div>
              </SheetContent>
            </Sheet>
            <img src="/logo.png" alt="Prottoy Foundation" className="h-7 w-7 rounded-full" />
            <h1 className="font-semibold">Prottoy Foundation</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleSignOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <div key={location.pathname} className="p-6">{children}</div>
      </main>
    </div>
  );
}
