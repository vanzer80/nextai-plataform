import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentType, ReactNode } from 'react';

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const Provider = NextThemesProvider as ComponentType<any>;

  return (
    <Provider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="portal-theme"
      disableTransitionOnChange
    >
      {children}
    </Provider>
  );
}
