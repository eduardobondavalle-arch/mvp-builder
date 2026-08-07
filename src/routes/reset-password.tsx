import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import adimLogo from "@/assets/adim-logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Redefinir senha | Adim Aluguéis" },
      {
        name: "description",
        content: "Defina uma nova senha para acessar o painel de inteligência comercial da Adim Aluguéis.",
      },
      { property: "og:title", content: "Redefinir senha | Adim Aluguéis" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar o painel da Adim Aluguéis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (senha.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      toast.error("As senhas não conferem.");
      return;
    }
    setCarregando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setCarregando(false);
    if (error) {
      toast.error("Link expirado ou inválido. Solicite um novo e-mail de recuperação.");
      return;
    }
    toast.success("Senha atualizada.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <img src={adimLogo} alt="Adim Aluguéis" className="h-11 w-auto" width={205} height={90} />
          <h1 className="text-xl font-semibold">Definir nova senha</h1>
        </div>

        <form
          onSubmit={salvar}
          className="space-y-4 rounded-2xl border border-border/70 bg-[var(--glass)] p-6 shadow-sm backdrop-blur-3xl backdrop-saturate-150"
        >
          <div className="space-y-2">
            <Label htmlFor="senha">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              autoComplete="new-password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmacao">Confirmar senha</Label>
            <Input
              id="confirmacao"
              type="password"
              autoComplete="new-password"
              required
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={carregando}>
            {carregando ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </div>
    </main>
  );
}
