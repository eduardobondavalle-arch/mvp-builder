import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChartLineUp,
  Kanban,
  CalendarCheck,
  Target,
  SlidersHorizontal,
  ClipboardText,
  FileText,
  UsersThree,
  UserCircle,
  SignOut,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import adimLogo from "@/assets/adim-logo.png";
import { NavScroll } from "@/components/nav-scroll";
import { ToggleTema } from "@/components/toggle-tema";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { limparUsuario } from "@/lib/usuario";

const nav = [
  { to: "/dashboard", label: "Inteligência", icon: ChartLineUp },
  { to: "/kanban", label: "Jornada Comercial", icon: Kanban },
  { to: "/registro-diario", label: "Registro Diário", icon: CalendarCheck },
  { to: "/ciclos", label: "Ciclos e Metas", icon: Target },
  { to: "/cadastros", label: "Cadastros", icon: SlidersHorizontal },
  { to: "/relatorios", label: "Relatórios", icon: FileText },
  { to: "/auditoria", label: "Auditoria", icon: ClipboardText },
  { to: "/acessos", label: "Acessos", icon: UsersThree },
] as const;


function UsuarioAtual() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    limparUsuario();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Popover>
      <PopoverTrigger className="press flex h-10 max-w-[180px] items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-3 text-xs text-muted-foreground hover:text-foreground">
        <UserCircle size={18} weight="fill" className="shrink-0" />
        <span className="hidden truncate sm:inline">{email || "Conta"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div>
          <p className="label-caps">Usuário conectado</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {email || "Sessão ativa"}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Este e-mail é registrado na auditoria de todas as alterações realizadas.
        </p>
        <Button variant="outline" size="sm" className="w-full rounded-full" onClick={sair}>
          <SignOut size={16} weight="bold" />
          Sair
        </Button>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-30 border-b border-border/60">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={adimLogo}
                alt="Adim Aluguéis"
                className="h-9 w-auto shrink-0"
                width={205}
                height={90}
              />
              <span className="hidden h-8 w-px shrink-0 bg-border sm:block" />
              <p className="label-caps hidden truncate sm:block">Inteligência Comercial</p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <ToggleTema />
              <UsuarioAtual />
            </div>
          </div>

          <NavScroll>
            <nav className="flex w-max items-center gap-1 rounded-full border border-border/60 bg-secondary/50 p-1">
              {nav.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  preload="intent"
                  activeOptions={{ exact: true }}
                  className="press flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  activeProps={{
                    className:
                      "bg-[var(--glass-strong)] text-foreground shadow-sm backdrop-blur-xl backdrop-saturate-150",
                  }}
                >
                  <item.icon size={18} weight="duotone" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </NavScroll>

          <div className="ml-auto hidden items-center gap-2 lg:flex">
            <ToggleTema />
            <UsuarioAtual />
          </div>
        </div>
      </header>

      <main
        key={pathname}
        className="page-transition mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
