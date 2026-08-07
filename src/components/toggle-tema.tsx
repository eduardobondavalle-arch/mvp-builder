import { Moon, Sun } from "@phosphor-icons/react";

import { useTema } from "@/lib/tema";

export function ToggleTema({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Ativar modo claro" : "Ativar modo escuro"}
      className={`relative flex size-9 items-center justify-center rounded-full border border-border bg-secondary/60 text-muted-foreground transition-all duration-300 hover:text-foreground active:scale-95 ${className}`}
    >
      <Sun
        size={18}
        weight="fill"
        className={`absolute transition-all duration-300 ${escuro ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
      />
      <Moon
        size={18}
        weight="fill"
        className={`absolute transition-all duration-300 ${escuro ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"}`}
      />
    </button>
  );
}
