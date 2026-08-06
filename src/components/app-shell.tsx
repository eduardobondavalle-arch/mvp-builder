import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  KanbanSquare,
  Building2,
  CalendarCheck,
  Target,
  Settings2,
  ScrollText,
  UserRound,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import adimLogo from "@/assets/adim-logo.png";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getUsuario, setUsuario } from "@/lib/usuario";


const nav = [
  { to: "/", label: "Inteligência", icon: BarChart3 },
  { to: "/kanban", label: "Jornada Comercial", icon: KanbanSquare },
  { to: "/registro-diario", label: "Registro Diário", icon: CalendarCheck },
  { to: "/ciclos", label: "Ciclos e Metas", icon: Target },
  { to: "/cadastros", label: "Cadastros", icon: Settings2 },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
] as const;

function UsuarioAtual() {
  const [nome, setNome] = useState("Gestão");
  useEffect(() => setNome(getUsuario()), []);
  return (
    <Popover>
      <PopoverTrigger className="ml-auto flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
        <UserRound className="size-4" />
        {nome}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-2">
        <p className="label-caps">Usuário responsável</p>
        <p className="text-xs text-muted-foreground">
          Nome registrado na auditoria de todas as alterações realizadas nesta sessão.
        </p>
        <Input
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setUsuario(e.target.value);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

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
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <img
              src={adimLogo}
              alt="Adim Aluguéis"
              className="h-9 w-auto"
              width={205}
              height={90}
            />
            <span className="hidden h-8 w-px bg-border sm:block" />
            <p className="label-caps hidden sm:block">Inteligência Comercial</p>
          </div>

          <nav className="flex flex-wrap items-center gap-1">
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
          <UsuarioAtual />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
