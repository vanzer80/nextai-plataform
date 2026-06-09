import { useEffect, useMemo, useState } from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeToggleProps = {
  compact?: boolean;
  className?: string;
};

export default function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
  const { theme = 'system', setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeTheme = useMemo<ThemeMode>(() => {
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      return theme;
    }
    return 'system';
  }, [theme]);

  const effectiveTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const icon = !mounted ? (
    <Laptop className="h-4 w-4" />
  ) : activeTheme === 'system' ? (
    <Laptop className="h-4 w-4" />
  ) : effectiveTheme === 'dark' ? (
    <Moon className="h-4 w-4" />
  ) : (
    <Sun className="h-4 w-4" />
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'inline-flex items-center justify-center border border-border bg-background text-foreground transition-colors hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact
            ? 'h-11 w-11 rounded-full'
            : 'h-9 rounded-lg gap-2 px-3 text-xs font-medium shadow-sm',
          className,
        )}
        aria-label={`Alternar tema (atual: ${activeTheme})`}
      >
        {icon}
        {!compact && <span>Tema</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <div className="px-1.5 py-1 text-xs font-medium text-muted-foreground">Tema</div>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={activeTheme}
          onValueChange={(value) => setTheme(value as ThemeMode)}
        >
          <DropdownMenuRadioItem value="light">Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Escuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
