import { useRef, useCallback } from 'react';
import { driver } from 'driver.js';
import type { DriveStep, Config } from 'driver.js';
import { useNavigate } from 'react-router-dom';
import { getTourSteps, type Role } from './tours/index';

type DriverInstance = ReturnType<typeof driver>;

function waitForElement(selector: string, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(selector)) { resolve(); return; }
    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) { obs.disconnect(); resolve(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); reject(new Error(`Timeout waiting for ${selector}`)); }, timeoutMs);
  });
}

export function useOnboardingDriver(onTourEnd: () => void) {
  const navigate = useNavigate();
  const driverRef = useRef<DriverInstance | null>(null);

  const startDriver = useCallback(async (role: Role) => {
    const allSteps = getTourSteps(role);

    // Filter out steps whose elements don't exist AND have no route (they're permanently absent)
    const steps = allSteps.filter(s => {
      if (s.route) return true; // include — navigation will handle it
      return document.querySelector(s.element) !== null;
    });

    if (steps.length === 0) { onTourEnd(); return; }

    const driveSteps: DriveStep[] = steps.map(s => ({
      element: s.element,
      popover: {
        title: s.popover.title,
        description: s.popover.description,
        side: s.popover.side,
        align: s.popover.align,
      },
    }));

    const navigateForStep = async (index: number) => {
      const step = steps[index];
      if (!step) return;
      const targetRoute = step.route;
      if (targetRoute && window.location.pathname !== targetRoute) {
        navigate(targetRoute);
        try {
          await waitForElement(step.element, 4000);
        } catch {
          // Element still not found after navigation — skip gracefully
        }
      }
    };

    const config: Config = {
      showProgress: true,
      animate: true,
      overlayOpacity: 0.5,
      smoothScroll: true,
      allowClose: true,
      progressText: '{{current}} de {{total}}',
      nextBtnText: 'Próximo →',
      prevBtnText: '← Anterior',
      doneBtnText: 'Concluir ✓',
      steps: driveSteps,

      onNextClick: async () => {
        const current = driverRef.current?.getActiveIndex() ?? 0;
        const nextIndex = current + 1;
        if (nextIndex >= steps.length) {
          driverRef.current?.destroy();
          return;
        }
        await navigateForStep(nextIndex);
        driverRef.current?.moveNext();
      },

      onPrevClick: async () => {
        const current = driverRef.current?.getActiveIndex() ?? 0;
        const prevIndex = current - 1;
        if (prevIndex < 0) return;
        await navigateForStep(prevIndex);
        driverRef.current?.movePrevious();
      },

      onDestroyStarted: () => {
        onTourEnd();
        driverRef.current?.destroy();
      },
    };

    driverRef.current = driver(config);

    await navigateForStep(0);
    driverRef.current.drive();
  }, [navigate, onTourEnd]);

  const destroyDriver = useCallback(() => {
    driverRef.current?.destroy();
    driverRef.current = null;
  }, []);

  return { startDriver, destroyDriver };
}
