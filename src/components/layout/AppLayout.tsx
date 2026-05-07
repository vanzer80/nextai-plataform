import React, { useState, Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Receipt,
  ShoppingCart,
  Building2,
  ShieldAlert,
  ListChecks,
  FileText,
  Globe,
  Menu,
  LogOut,
  Loader2,
  Home,
  Bell,
  Sun,
  Moon,
  Laptop,
  Check,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { supabase } from '@/src/lib/supabase';
import { useAuth, type AuthUser } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { useOfflineSync } from '@/src/hooks/useOfflineSync';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/src/components/theme/ThemeToggle';
import clsx from 'clsx';

// Configuration of navigation links
const NAV_LINKS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Financeiro', 'Comprador', 'Admin', 'Master'] },
  { name: 'Relatórios', path: '/reports', icon: ClipboardList, roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'] },
  { name: 'Orçamentos', path: '/orcamentos', icon: FileText, roles: ['Tecnico', 'Supervisor', 'Gestor', 'Admin', 'Master'] },
  { name: 'Reembolsos', path: '/reimbursements', icon: Receipt, roles: ['Tecnico', 'Supervisor', 'Gestor', 'Financeiro', 'Admin', 'Master'] },
  { name: 'Compras', path: '/materials', icon: ShoppingCart, roles: ['Tecnico', 'Administrativo', 'Supervisor', 'Gestor', 'Comprador', 'Admin', 'Master'] },
  { name: 'Clientes', path: '/clients', icon: Building2, roles: ['Supervisor', 'Gestor', 'Admin', 'Master'] },
  { name: 'Checklists', path: '/admin/checklist-templates', icon: ListChecks, roles: ['Gestor', 'Admin', 'Master'] },
  { name: 'Administrador', path: '/admin/usuarios', icon: ShieldAlert, roles: ['Gestor', 'Admin', 'Master'] },
  { name: 'Tenants', path: '/admin/tenants', icon: Globe, roles: ['Master'] },
];

// All possible bottom nav options (mobile quick-access bar)
const ALL_BOTTOM_NAV_OPTIONS = [
  { name: 'Início',        path: '/dashboard',                 icon: Home          },
  { name: 'Relatórios',    path: '/reports',                   icon: ClipboardList },
  { name: 'Orçamentos',    path: '/orcamentos',                icon: FileText      },
  { name: 'Reembolsos',    path: '/reimbursements',            icon: Receipt       },
  { name: 'Compras',       path: '/materials',                 icon: ShoppingCart  },
  { name: 'Clientes',      path: '/clients',                   icon: Building2     },
  { name: 'Checklists',    path: '/admin/checklist-templates', icon: ListChecks    },
  { name: 'Admin',         path: '/admin/usuarios',            icon: ShieldAlert   },
];

const BOTTOM_NAV_KEY = (uid: string) => `portal-bnav-${uid}`;
const DEFAULT_BOTTOM_PATHS = ['/dashboard', '/reports', '/materials'];

// ─── Outlet context ───────────────────────────────────────────────────────────
// Exported so page components inside AppLayout's Outlet can consume it
// via useOutletContext<AppLayoutOutletContext>() instead of creating a
// second useOfflineSync() instance.
export interface AppLayoutOutletContext {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────
function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ─── UserProfileSheet ─────────────────────────────────────────────────────────
// Sheet replaces DropdownMenu for the profile trigger.
// DropdownMenu (Base UI portal) caused error #31 when multiple SIGNED_IN events
// fired concurrently during auth init, crashing React mid-render.
interface UserProfileDropdownProps {
  user: AuthUser | null;
  userRole: string;
  onSignOut: () => void;
  authorizedLinks: { name: string; path: string; icon: React.ComponentType<any>; roles: string[] }[];
  activeBottomLinks: string[];
  saveBottomNavLinks: (paths: string[]) => void;
}

const THEME_OPTIONS = [
  { value: 'light',  label: 'Claro',   Icon: Sun    },
  { value: 'dark',   label: 'Escuro',  Icon: Moon   },
  { value: 'system', label: 'Sistema', Icon: Laptop },
] as const;

function UserProfileDropdown({ user, userRole, onSignOut, authorizedLinks, activeBottomLinks, saveBottomNavLinks }: UserProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const { theme = 'light', setTheme } = useTheme();
  const activeTheme = (theme === 'light' || theme === 'dark' || theme === 'system') ? theme : 'light';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="flex items-center gap-3 text-left w-full p-2 rounded-xl transition-colors hover:bg-sidebar-accent outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
          <Avatar className="h-10 w-10 border-2 border-sidebar-border shrink-0">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
              {getInitials(user?.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden hidden lg:block">
            <p className="text-sm font-semibold text-sidebar-foreground truncate">
              {user?.full_name || user?.email?.split('@')[0] || 'Usuário'}
            </p>
            <p className="text-xs text-sidebar-foreground/70 truncate">{userRole}</p>
          </div>
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0 flex flex-col">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle className="text-base font-semibold">Minha Conta</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── Profile info ── */}
          <div className="flex flex-col items-center px-6 pt-8 pb-6 gap-4">
            <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="text-center space-y-1">
              <p className="text-xl font-bold text-foreground leading-tight">
                {user?.full_name || 'Usuário'}
              </p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {userRole}
              </span>
              <p className="text-sm text-muted-foreground pt-1 break-all">{user?.email}</p>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Theme picker ── */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Aparência</p>
            <div className="grid grid-cols-3 gap-2">
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={clsx(
                    'flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg border text-xs font-medium transition-all',
                    activeTheme === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* ── Bottom Nav customization ── */}
          <div className="px-6 py-5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Rodapé Rápido</p>
            <p className="text-xs text-muted-foreground mb-3">Escolha até 3 atalhos · mín. 1</p>
            <div className="space-y-1">
              {ALL_BOTTOM_NAV_OPTIONS
                .filter(o => authorizedLinks.some(l => l.path === o.path))
                .map((option) => {
                  const Icon = option.icon;
                  const isSelected = activeBottomLinks.includes(option.path);
                  const atMax = activeBottomLinks.length >= 3 && !isSelected;
                  const isLast = activeBottomLinks.length === 1 && isSelected;
                  const disabled = atMax || isLast;
                  return (
                    <button
                      key={option.path}
                      onClick={() => {
                        if (disabled) return;
                        if (isSelected) {
                          saveBottomNavLinks(activeBottomLinks.filter(p => p !== option.path));
                        } else {
                          saveBottomNavLinks([...activeBottomLinks, option.path]);
                        }
                      }}
                      className={clsx(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                        disabled && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{option.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* ── Sign out (sticky footer) ── */}
        <div className="px-6 py-5 border-t border-border shrink-0">
          <Button
            onClick={() => { setOpen(false); onSignOut(); }}
            variant="outline"
            className="w-full justify-start text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors h-11"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair da Conta
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── NotificationsDropdown ────────────────────────────────────────────────────
// Same rationale: module-level to prevent unmount/remount on AppLayout re-render.
interface NotificationsDropdownProps {
  notifications: any[];
  unreadCount: number;
  onMarkAsRead: (id: string, is_read: boolean) => Promise<void>;
}

function NotificationsDropdown({ notifications, unreadCount, onMarkAsRead }: NotificationsDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-full hover:bg-sidebar-accent active:bg-sidebar-accent/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Bell className="h-5 w-5 text-sidebar-foreground/80 hover:text-sidebar-foreground transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-destructive rounded-full border-2 border-sidebar animate-pulse" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-semibold text-foreground">Notificações</p>
          {unreadCount > 0 && <Badge variant="secondary">{unreadCount} novas</Badge>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhuma notificação por enquanto.</div>
          ) : (
            notifications.map((notif: any) => (
              <div
                key={notif.id}
                className={clsx('p-4 border-b border-border text-sm hover:bg-muted/50 cursor-pointer transition-colors', !notif.is_read && 'bg-accent/40')}
                onClick={() => onMarkAsRead(notif.id, notif.is_read)}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                  <p className={clsx('font-semibold', !notif.is_read ? 'text-foreground' : 'text-muted-foreground')}>{notif.title}</p>
                  {!notif.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
                <p className="text-muted-foreground line-clamp-2 leading-snug">{notif.message}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-2 font-medium">
                  {new Date(notif.created_at).toLocaleDateString()}{' '}
                  {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────
export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { tenant } = useTenant();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isOnline, isSyncing, pendingCount } = useOfflineSync();

  const userRole = user?.role || 'Tecnico';
  const authorizedLinks = NAV_LINKS.filter(link => {
    if (!link.roles.some(r => r.toLowerCase() === userRole.toLowerCase())) return false;
    if (link.path === '/admin/tenants' && !tenant?.isPlatform) return false;
    return true;
  });

  const handleSignOut = async () => {
    await signOut();
  };

  const [notifications, setNotifications] = useState<any[]>([]);

  React.useEffect(() => {
    if (!user?.id) return;

    // Subscribe first — notifications that arrive during fetch are captured
    const channel = supabase.channel('realtime_app_notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => {
          if (prev.some(n => n.id === payload.new.id)) return prev;
          return [payload.new, ...prev].slice(0, 10);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
      })
      .subscribe();

    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (data) setNotifications(data);
    };
    fetchNotifs();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const markAsRead = async (id: string, is_read: boolean) => {
    if (is_read) return;
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const [activeBottomLinks, setActiveBottomLinks] = useState<string[]>(DEFAULT_BOTTOM_PATHS);

  React.useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(BOTTOM_NAV_KEY(user.id));
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        if (Array.isArray(parsed) && parsed.length >= 1) setActiveBottomLinks(parsed);
      }
    } catch {}
  }, [user?.id]);

  const saveBottomNavLinks = (paths: string[]) => {
    if (!user?.id) return;
    setActiveBottomLinks(paths);
    localStorage.setItem(BOTTOM_NAV_KEY(user.id), JSON.stringify(paths));
  };

  const renderNavLinks = (isMobile = false) => {
    return authorizedLinks.map((link) => {
      const Icon = link.icon;
      const isActive = location.pathname === link.path;
      const showPendingBadge = link.path === '/reports' && pendingCount > 0;

      return (
        <NavLink
          key={link.path}
          to={link.path}
          onClick={() => isMobile && setIsMobileMenuOpen(false)}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded-lg',
            isActive
              ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
              : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          <Icon className="h-5 w-5 shrink-0" />
          <span className="flex-1">{link.name}</span>
          {showPendingBadge && (
            <span className="ml-auto h-5 min-w-5 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </NavLink>
      );
    });
  };

  const outletCtx: AppLayoutOutletContext = { isOnline, isSyncing, pendingCount };

  return (
    <div className="flex h-screen w-full bg-background font-sans text-foreground overflow-hidden">

      {/* DESKTOP SIDEBAR (Hidden on mobile) */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-sidebar text-sidebar-foreground shrink-0 border-r border-sidebar-border z-50">
        <div className="flex items-center px-6 py-6 h-[80px]">
          <div className="text-2xl font-extrabold tracking-tight">
            PORTAL<span className="text-primary">MOPAR</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {renderNavLinks()}
        </div>

        <div className="p-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <UserProfileDropdown user={user} userRole={userRole} onSignOut={handleSignOut} authorizedLinks={authorizedLinks} activeBottomLinks={activeBottomLinks} saveBottomNavLinks={saveBottomNavLinks} />
            </div>
            <NotificationsDropdown notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} />
          </div>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="lg:hidden fixed top-0 w-full h-[64px] bg-sidebar text-sidebar-foreground z-40 flex items-center justify-between px-4 border-b border-sidebar-border">
        <div className="text-xl font-extrabold tracking-tight">
          P<span className="text-primary">MOPAR</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Profile & Notifications in TopBar */}
          <ThemeToggle compact />
          <NotificationsDropdown notifications={notifications} unreadCount={unreadCount} onMarkAsRead={markAsRead} />
          <div className="mr-2">
            <UserProfileDropdown user={user} userRole={userRole} onSignOut={handleSignOut} authorizedLinks={authorizedLinks} activeBottomLinks={activeBottomLinks} saveBottomNavLinks={saveBottomNavLinks} />
          </div>

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger className="inline-flex items-center justify-center shrink-0 h-10 w-10 rounded-md text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent/80 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] sm:w-[350px] bg-sidebar text-sidebar-foreground border-l border-sidebar-border p-0 flex flex-col">
              <SheetHeader className="p-6 text-left border-b border-sidebar-border shrink-0">
                <SheetTitle className="text-sidebar-foreground text-xl font-bold">Menu Principal</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
                {renderNavLinks(true)}
              </div>
              <div className="p-4 border-t border-sidebar-border shrink-0">
                <Button
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }}
                  variant="outline"
                  className="w-full justify-start bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors h-12"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  Sair da Conta
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV */}
      <nav className="lg:hidden fixed bottom-0 w-full h-[72px] bg-card border-t border-border z-40 flex items-center justify-around pb-safe">
        {ALL_BOTTOM_NAV_OPTIONS
          .filter(o => activeBottomLinks.includes(o.path) && authorizedLinks.some(l => l.path === o.path))
          .sort((a, b) => activeBottomLinks.indexOf(a.path) - activeBottomLinks.indexOf(b.path))
          .map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.path;
            return (
              <NavLink
                key={link.path}
                to={link.path}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className={clsx('h-6 w-6', isActive && 'fill-primary/15')} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{link.name}</span>
              </NavLink>
            );
          })}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full pt-[64px] pb-[72px] lg:pt-0 lg:pb-0 overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Suspense fallback={<div className="flex items-center justify-center h-48"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <Outlet context={outletCtx} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
