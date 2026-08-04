import { Link } from "@tanstack/react-router";
import { BarChart3, KanbanSquare, Building2 } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Inteligência Comercial", icon: BarChart3 },
  { to: "/kanban", label: "Jornada Comercial", icon: KanbanSquare },
] as const;

export function AppShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Building2 className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Adim Aluguéis</p>
              <p className="label-caps">Plataforma de Gestão</p>
            </div>
          </div>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
