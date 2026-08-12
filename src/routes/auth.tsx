import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import adimLogo from "@/assets/adim-logo.png";

import { LoginCharacters } from "@/components/login-characters";
import { ToggleTema } from "@/components/toggle-tema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      {
        title: "Acesso restrito | Adim Aluguéis",
      },
      {
        name: "description",
        content:
          "Área restrita da plataforma de inteligência comercial da Adim Aluguéis. Entre com e-mail e senha para acessar o painel.",
      },
      {
        property: "og:title",
        content: "Acesso restrito | Adim Aluguéis",
      },
      {
        property: "og:description",
        content:
          "Área restrita da plataforma de inteligência comercial da Adim Aluguéis.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
    ],
  }),

  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [modo, setModo] = useState<
    "login" | "recuperar"
  >("login");

  const [carregando, setCarregando] =
    useState(false);

  /*
   * Informa aos personagens qual campo
   * está sendo utilizado no momento.
   */
  const [activeField, setActiveField] =
    useState<
      "none" | "email" | "password"
    >("none");

  /*
   * Verifica se o usuário já está
   * autenticado.
   */
  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) {
          navigate({
            to: "/dashboard",
            replace: true,
          });
        }
      });
  }, [navigate]);

  /*
   * LOGIN
   */
  async function entrar(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setCarregando(true);

    const { error } =
      await supabase.auth.signInWithPassword(
        {
          email: email.trim(),
          password: senha,
        },
      );

    setCarregando(false);

    if (error) {
      toast.error(
        error.message
          .toLowerCase()
          .includes("invalid")
          ? "E-mail ou senha incorretos."
          : "Não foi possível entrar. Tente novamente.",
      );

      return;
    }

    navigate({
      to: "/dashboard",
      replace: true,
    });
  }

  /*
   * RECUPERAÇÃO DE SENHA
   */
  async function recuperar(
    e: React.FormEvent,
  ) {
    e.preventDefault();

    setCarregando(true);

    const { error } =
      await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        },
      );

    setCarregando(false);

    if (error) {
      toast.error(
        "Não foi possível enviar o e-mail de recuperação.",
      );

      return;
    }

    toast.success(
      "Enviamos um link de redefinição para o seu e-mail.",
    );

    setModo("login");
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ================================
          ALTERAR TEMA
      ================================= */}

      <div className="absolute right-4 top-4 z-50">
        <ToggleTema />
      </div>

      {/* ================================
          LAYOUT
      ================================= */}

      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        {/* ================================
            PERSONAGENS
        ================================= */}

        <div className="relative hidden items-center justify-center overflow-hidden lg:flex">
          <LoginCharacters
            activeField={activeField}
          />
        </div>

        {/* ================================
            LOGIN
        ================================= */}

        <div className="flex items-center justify-center px-4 py-12 sm:px-6">
          <div className="page-transition w-full max-w-sm">
            {/* CABEÇALHO */}

            <div className="mb-8 flex flex-col items-center gap-4 text-center">
              <img
                src={adimLogo}
                alt="Adim Aluguéis"
                className="h-11 w-auto"
                width={205}
                height={90}
              />

              <div>
                <h1 className="text-xl font-semibold">
                  Inteligência Comercial
                </h1>

                <p className="mt-1 text-sm text-muted-foreground">
                  Acesso restrito à equipe
                  Adim Aluguéis.
                </p>
              </div>
            </div>

            {/* ================================
                FORMULÁRIO
            ================================= */}

            <form
              onSubmit={
                modo === "login"
                  ? entrar
                  : recuperar
              }
              className="space-y-4 rounded-2xl border border-border/70 bg-[var(--glass)] p-6 shadow-sm backdrop-blur-3xl backdrop-saturate-150"
            >
              {/* ================================
                  E-MAIL
              ================================= */}

              <div className="space-y-2">
                <Label htmlFor="email">
                  E-mail
                </Label>

                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value,
                    )
                  }
                  onFocus={() =>
                    setActiveField(
                      "email",
                    )
                  }
                  onBlur={() =>
                    setActiveField(
                      "none",
                    )
                  }
                  placeholder="voce@adimalugueis.com.br"
                />
              </div>

              {/* ================================
                  SENHA
              ================================= */}

              {modo === "login" ? (
                <div className="space-y-2">
                  <Label htmlFor="senha">
                    Senha
                  </Label>

                  <Input
                    id="senha"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={senha}
                    onChange={(e) =>
                      setSenha(
                        e.target.value,
                      )
                    }
                    onFocus={() =>
                      setActiveField(
                        "password",
                      )
                    }
                    onBlur={() =>
                      setActiveField(
                        "none",
                      )
                    }
                  />
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Informe o e-mail cadastrado
                  e enviaremos um link para
                  você criar uma nova senha.
                </p>
              )}

              {/* ================================
                  BOTÃO
              ================================= */}

              <Button
                type="submit"
                className="w-full"
                disabled={carregando}
              >
                {carregando
                  ? "Aguarde..."
                  : modo === "login"
                    ? "Entrar"
                    : "Enviar link de recuperação"}
              </Button>

              {/* ================================
                  RECUPERAÇÃO
              ================================= */}

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setActiveField(
                    "none",
                  );

                  setModo(
                    modo === "login"
                      ? "recuperar"
                      : "login",
                  );
                }}
              >
                {modo === "login"
                  ? "Esqueci minha senha"
                  : "Voltar para o login"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Novos acessos são criados pela
              gestão.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}