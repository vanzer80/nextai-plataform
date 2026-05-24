import { Suspense } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/src/lib/supabase';
import { useTenant } from '@/src/contexts/TenantContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { NextAILogo } from '@/src/components/brand/NextAILogo';

export default function ClientPortalLayout() {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Top bar */}
      <header className="bg-card border-b border-border shadow-sm shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.name} className="h-7 object-contain" />
            ) : (
              <NextAILogo className="h-6" />
            )}
            {tenant?.name && (
              <span className="font-semibold text-foreground text-sm hidden sm:block">{tenant.name}</span>
            )}
            <span className="text-xs text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Portal do Cliente
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-[160px]">
              {user?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
