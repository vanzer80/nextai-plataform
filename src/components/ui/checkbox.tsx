import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer size-4 shrink-0 rounded-[4px] border border-input shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-checked:text-primary-foreground data-checked:border-primary",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className="flex items-center justify-center text-current transition-none"
      >
        <Check className="size-3 stroke-[2.5]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
