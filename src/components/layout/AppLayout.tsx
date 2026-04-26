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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
              ? 'bg-blue-600 text-white shadow-md' 
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
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
      <DropdownMenuTrigger className="flex items-center gap-3 text-left w-full p-2 rounded-xl transition-colors hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer">
        <Avatar className="h-10 w-10 border-2 border-slate-700">
          <AvatarFallback className="bg-blue-600 text-white text-sm font-bold">
            {getInitials(user?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 overflow-hidden hidden lg:block">
          <p className="text-sm font-semibold text-white truncate w-full">
            {user?.full_name || user?.email?.split('@')[0] || 'Usuário'}
          </p>
          <p className="text-xs text-blue-400 truncate w-full">
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
        <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-rose-600 focus:bg-rose-50 focus:text-rose-700">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const NotificationsDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger className="relative p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
        <Bell className="h-5 w-5 text-slate-300 hover:text-white transition-colors" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-rose-500 rounded-full border-2 border-slate-950 animate-pulse" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <p className="font-semibold text-slate-900">Notificações</p>
          {unreadCount > 0 && <Badge variant="secondary" className="bg-blue-100 text-blue-700">{unreadCount} novas</Badge>}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
             <div className="p-6 text-center text-slate-500 text-sm">Nenhuma notificação por enquanto.</div>
          ) : (
            notifications.map((notif: any) => (
              <div 
                key={notif.id} 
                className={clsx("p-4 border-b border-slate-50 text-sm hover:bg-slate-50 cursor-pointer transition-colors", !notif.is_read && "bg-blue-50/50")}
                onClick={() => markAsRead(notif.id, notif.is_read)}
              >
                <div className="flex justify-between items-start mb-1 gap-2">
                   <p className={clsx("font-semibold", !notif.is_read ? "text-slate-900" : "text-slate-700")}>{notif.title}</p>
                   {!notif.is_read && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 mt-1.5" />}
                </div>
                <p className="text-slate-600 line-clamp-2 leading-snug">{notif.message}</p>
                <p className="text-[10px] text-slate-400 mt-2 font-medium">{new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* DESKTOP SIDEBAR (Hidden on mobile) */}
      <aside className="hidden lg:flex w-[260px] flex-col bg-slate-950 text-white shrink-0 shadow-xl z-50">
        <div className="flex items-center px-6 py-6 h-[80px]">
          <div className="text-2xl font-extrabold tracking-tight">
            PORTAL<span className="text-blue-600">MOPAR</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {renderNavLinks()}
        </div>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 min-w-0 pr-2">
              <UserProfileDropdown />
            </div>
            <div className="shrink-0">
              <NotificationsDropdown />
            </div>
          </div>
          <Button 
            onClick={handleSignOut} 
            variant="outline" 
            className="w-full justify-start text-slate-300 bg-slate-900 border-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors h-11"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair da Conta
          </Button>
        </div>
      </aside>

      {/* MOBILE TOP HEADER */}
      <header className="lg:hidden fixed top-0 w-full h-[64px] bg-slate-950 text-white z-40 flex items-center justify-between px-4 shadow-md">
        <div className="text-xl font-extrabold tracking-tight">
          P<span className="text-blue-600">MOPAR</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Profile & Notifications in TopBar */}
          <NotificationsDropdown />
          <div className="mr-2">
            <UserProfileDropdown />
          </div>

          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger className="inline-flex items-center justify-center shrink-0 h-10 w-10 rounded-md text-white hover:bg-white/10 active:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[80vw] sm:w-[350px] bg-slate-950 text-white border-0 p-0 flex flex-col">
              <SheetHeader className="p-6 text-left border-b border-slate-800 shrink-0">
                <SheetTitle className="text-white text-xl font-bold">Menu Principal</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
                {renderNavLinks(true)}
              </div>
              <div className="p-4 border-t border-slate-800 shrink-0">
                <Button 
                  onClick={() => {
                    handleSignOut();
                    setIsMobileMenuOpen(false);
                  }} 
                  variant="outline" 
                  className="w-full justify-start text-slate-300 bg-slate-900 border-slate-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-colors h-12"
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
      <nav className="lg:hidden fixed bottom-0 w-full h-[72px] bg-white border-t border-slate-200 z-40 flex items-center justify-around pb-safe">
        {BOTTOM_NAV_LINKS.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.path;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Icon className={clsx("h-6 w-6", isActive && "fill-blue-100/50")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{link.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full pt-[64px] pb-[72px] lg:pt-0 lg:pb-0 overflow-hidden bg-slate-50/50">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
