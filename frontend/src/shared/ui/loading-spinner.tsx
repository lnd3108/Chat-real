import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

type LoadingSpinnerProps = {
  className?: string;
};

export const LoadingSpinner = ({ className }: LoadingSpinnerProps) => {
  return <Loader2 className={cn("animate-spin", className)} aria-hidden="true" />;
};
