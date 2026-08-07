import type { CSSProperties } from "react";

import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonKpis({ total = 8 }: { total?: number }) {
  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="panel rise-in p-5" style={{ "--delay": `${i * 35}ms` } as CSSProperties}>
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="size-4 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-2 h-3 w-40" />
        </div>
      ))}
    </section>
  );
}

export function SkeletonPanel({
  linhas = 4,
  className = "",
}: {
  linhas?: number;
  className?: string;
}) {
  return (
    <section className={`panel p-6 ${className}`}>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-64" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: linhas }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" style={{ opacity: 1 - i * 0.12 }} />
        ))}
      </div>
    </section>
  );
}

export function SkeletonTabela({ linhas = 6, colunas = 5 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: linhas }).map((_, i) => (
        <div
          key={i}
          className="grid gap-3"
          style={{ gridTemplateColumns: `1.6fr repeat(${colunas - 1}, 1fr)` }}
        >
          {Array.from({ length: colunas }).map((__, j) => (
            <Skeleton key={j} className="h-4" style={{ opacity: 1 - i * 0.1 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ total = 6 }: { total?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="panel rise-in p-5" style={{ "--delay": `${i * 35}ms` } as CSSProperties}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
          <Skeleton className="mt-5 h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
