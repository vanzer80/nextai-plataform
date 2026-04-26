import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';
import type { ChecklistTemplate, ServiceType } from '@/src/types/reports';

export function useChecklistTemplate(serviceType: ServiceType | null | undefined) {
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!serviceType) {
      setTemplate(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('checklist_templates')
      .select(`
        id, name, description, service_type, asset_category, is_active,
        items:checklist_template_items(
          id, template_id, order_index, label, description, item_type, options, is_required
        )
      `)
      .eq('service_type', serviceType)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setTemplate(null);
        } else {
          const t = data as ChecklistTemplate;
          if (t.items) {
            t.items = [...t.items].sort((a, b) => a.order_index - b.order_index);
          }
          setTemplate(t);
        }
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [serviceType]);

  return { template, loading };
}
