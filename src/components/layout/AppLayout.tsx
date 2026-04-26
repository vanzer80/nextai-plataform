import React, { useState } from 'react';
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
  Menu,
  LogOut,
  User as UserIcon,
  Home,
  Bell
} from 'lucide-react';

import { supabase } from '@/src/lib/supabase';

import { useAuth } from '@/src/contexts/AuthContext';
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
];

// Bottom Nav Links (Fast access for mobile)
const BOTTOM_NAV_LINKS = [
  { name: 'Início', path: '/dashboard', icon: Home },
  { name: 'Relatórios', path: '/reports', icon: ClipboardList },
  { name: 'Compras', path: '/materials', icon: ShoppingCart },
];

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Filter links based on user role
  const userRole = user?.role || 'Tecnico'; // fallback
  const authorizedLinks = NAV_LINKS.filter(link => 
    link.roles.some(allowedRole => userRole.toLowerCase().includes(allowedRole.toLowerCase())) || 
    user?.email === 'vanzer80@gmail.com'
  );

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const [notifications, setNotifications] = useState<any[]>([]);

  React.useEffect(() => {
    if (!user?.id) return;

    // Inscrever primeiro — notificações que chegarem durante o fetch são capturadas
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

    // Buscar após inscrição
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

  const renderNavLinks = (isMobile = false) => {
    return authorizedLinks.map((link) => {
      const Icon = link.icon;
      const isActive = location.pathname === link.path;
      
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
          {link.name}
        </NavLink>
      );
    });
  };

  const UserProfileDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-3 text-left w-full p-2 rounded-xl transition-colors hover:bg-sidebar-accent outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer">
        <Avatar className="h-10 w-10 border-2 border-sidebar-border">
          <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm font-bold">
            {getInitials(user?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden hidden lg:block">
          <p className="text-sm font-semibold text-sidebar-foreground truncate w-full">
            {user?.full_name || user?.email?.split('@')[0] || 'Usuário'}
          </p>
          <p className="text-xs text-sidebar-foreground/70 truncate w-full">
            {userRole}
          </p>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" sideOffset={8}>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <UserIcon className="mr-2 h-4 w-4" />
          <span>Minha Conta</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} variant="destructive" className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const NotificationsDropdown = () => (
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
                onClick={() => markAsRead(notif.id, notif.is_read)}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                   <p className={clsx('font-semibold', !notif.is_read ? 'text-foreground' : 'text-muted-foreground')}>{notif.title}</p>
                   {!notif.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
                <p className="text-muted-foreground line-clamp-2 leading-snug">{notif.message}</p>
                <p className="text-[10px] text-muted-foreground/80 mt-2 font-medium">{new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

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

        <div className="p-4 border-t border-sidebar-border flex flex-col gap-3">
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex-1 min-w-0 pr-2">
              <UserProfileDropdown />
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <NotificationsDropdown />
            </div>
          </div>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            className="w-full justify-start bg-sidebar text-sidebar-foreground border-sidebar-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors h-11"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair da Conta
          </Button>
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
          <NotificationsDropdown />
          <div className="mr-2">
            <UserProfileDropdown />
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
        {BOTTOM_NAV_LINKS.map((link) => {
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

      <div className="fixed right-4 bottom-[84px] lg:bottom-4 z-[60]">
        <ThemeToggle className="shadow-md" />
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full pt-[64px] pb-[72px] lg:pt-0 lg:pb-0 overflow-hidden bg-background">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
