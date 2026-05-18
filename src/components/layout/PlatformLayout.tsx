import React, { useState, Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, Users, Settings, Menu, LogOut, Loader2, Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/src/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import clsx from 'clsx';

const PLATFORM_NAV = [
  { name: 'Empresas', path: '/platform/tenants', icon: Building2 },
  { name: 'Usuários', path: '/platform/users', icon: Users },
  { name: 'Configurações', path: '/platform/settings', icon: Settings },
];

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const THEME_OPTS = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Auto', Icon: Laptop },
] as const;

export default function PlatformLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme = 'light', setTheme } = useTheme();
  const activeTheme = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'light';

  const renderNavLinks = (isMobile = false) =>
    PLATFORM_NAV.map(({ name, path, icon: Icon }) => {
      const isActive = location.pathname.startsWith(path);
      return (
        <NavLink
          key={path}
          to={path}
          onClick={() => isMobile && setMobileOpen(false)}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-lg',
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span>{name}</span>
        </NavLink>
      );
    });

  return (
    <div className="flex h-screen w-full bg-background font-sans text-foreground overflow-hidden">

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-sidebar text-sidebar-foreground shrink-0 border-r border-sidebar-border z-50">
        <div className="px-6 py-6 h-[80px] border-b border-sidebar-border flex items-center gap-3">
          <span className="text-2xl font-extrabold tracking-tight text-sidebar-foreground">
            Next<span className="opacity-50">AI</span>
          </span>
          <Badge className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary border-0 font-bold">
            Platform
          </Badge>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {renderNavLinks()}
        </div>

        <div className="p-4 border-t border-sidebar-border space-y-3">
          {/* Theme toggle */}
          <div className="flex items-center gap-1 p-1 bg-sidebar-accent/40 rounded-lg">
            {THEME_OPTS.map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all',
                  activeTheme === value
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/60 hover:text-sidebar-foreground'
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* User row */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-sidebar-accent transition-colors">
            <Avatar className="h-9 w-9 border-2 border-sidebar-border shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden min-w-0">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">
                {user?.full_name || 'SuperMaster'}
              </p>
              <p className="text-[11px] text-sidebar-foreground/60 truncate">{user?.email}</p>
            </div>
            <button
              onClick={() => signOut()}
              title="Sair"
              className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:bg-destructive/20 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 w-full h-[64px] bg-sidebar text-sidebar-foreground z-40 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-sidebar-foreground">
            Next<span className="opacity-50">AI</span>
          </span>
          <Badge className="text-[10px] px-1.5 py-0.5 bg-primary/15 text-primary border-0 font-bold">
            Platform
          </Badge>
        </div>
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger className="inline-flex items-center justify-center h-10 w-10 rounded-md text-sidebar-foreground hover:bg-sidebar-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Menu className="h-6 w-6" />
          </SheetTrigger>
          <SheetContent side="right" className="w-[260px] bg-sidebar text-sidebar-foreground border-l border-sidebar-border p-0 flex flex-col">
            <SheetHeader className="p-6 border-b border-sidebar-border">
              <SheetTitle className="text-sidebar-foreground text-base font-bold">Menu Platform</SheetTitle>
            </SheetHeader>
            <div className="flex-1 px-4 py-4 space-y-1">
              {renderNavLinks(true)}
            </div>
            <div className="p-4 border-t border-sidebar-border">
              <Button
                onClick={() => { signOut(); setMobileOpen(false); }}
                variant="outline"
                className="w-full justify-start bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors h-12"
              >
                <LogOut className="mr-3 h-5 w-5" />
                Sair da Conta
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full h-full pt-[64px] lg:pt-0 overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Suspense fallback={
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
