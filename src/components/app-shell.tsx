import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChartLineUp,
  Kanban,
  CalendarCheck,
  Target,
  SlidersHorizontal,
  ClipboardText,
  UsersThree,
  UserCircle,
  SignOut,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";

import adimLogo from "@/assets/adim-logo.png";
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
      <PopoverTrigger className="flex max-w-[180px] items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground active:scale-95">
        <UserCircle size={18} weight="fill" className="shrink-0" />
        <span className="truncate">{email || "Conta"}</span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3 rounded-2xl">
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
      <header className="glass sticky top-0 z-30 border-b border-border/70">
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

          <nav className="flex flex-wrap items-center gap-1 rounded-full border border-border/70 bg-secondary/50 p-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: true }}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-background/70 hover:text-foreground active:scale-95"
                activeProps={{
                  className: "bg-[var(--glass)] text-foreground shadow-[0_1px_2px_0_oklch(0_0_0/10%)] backdrop-blur-xl backdrop-saturate-150",
                }}
              >
                <item.icon size={18} weight="duotone" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <ToggleTema />
            <UsuarioAtual />
          </div>
        </div>
      </header>

      <main key={pathname} className="page-transition mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}
