import { useOnboarding } from './OnboardingContext';

interface OnboardingButtonProps {
  className?: string;
  label?: string;
}

export function OnboardingButton({ className, label = 'Repetir tutorial' }: OnboardingButtonProps) {
  const { resetTour } = useOnboarding();
  return (
    <button
      type="button"
      onClick={resetTour}
      className={className ?? 'text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors'}
    >
      {label}
    </button>
  );
}
