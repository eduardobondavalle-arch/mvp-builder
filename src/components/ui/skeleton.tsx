import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-foreground/[0.07] dark:bg-foreground/[0.1]", className)}
      {...props}
    />
  );
}

export { Skeleton };
