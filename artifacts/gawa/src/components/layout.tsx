import { Link, useLocation } from "wouter";
import { Home, Receipt, CalendarClock, Activity, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: Home, label: "Home" },
    { href: "/events", icon: Receipt, label: "Events" },
    { href: "/trips", icon: MapIcon, label: "Trips" },
    { href: "/recurring", icon: CalendarClock, label: "Recurring" },
    { href: "/activity", icon: Activity, label: "Activity" },
  ];

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background text-foreground">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary text-primary-foreground font-mono font-bold px-2 py-1 rounded">G</div>
            <span className="font-bold text-lg tracking-tight">Gawa</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-0 md:pl-64">
        {children}
      </main>

      {/* Bottom Nav (Mobile) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background md:hidden pb-safe">
        <nav className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-1 text-xs font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Nav (Desktop) */}
      <aside className="hidden md:flex fixed top-14 left-0 bottom-0 z-30 w-64 flex-col border-r border-border bg-background">
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
