import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

export interface TenantData {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface TenantContextType {
  tenant: TenantData | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.team_id) {
      setTenant(null);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    supabase
      .from('tenants')
      .select('id, slug, name, logo_url, primary_color')
      .eq('id', user.team_id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('[TenantContext] Error fetching tenant:', error.message);
        } else if (data) {
          setTenant({
            id: data.id,
            slug: data.slug,
            name: data.name,
            logoUrl: data.logo_url,
            primaryColor: data.primary_color,
          });
        }
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.team_id, authLoading]);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider');
  return ctx;
}
