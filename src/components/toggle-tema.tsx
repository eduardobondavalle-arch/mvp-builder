import { Moon, Sun } from "@phosphor-icons/react";

import { useTema } from "@/lib/tema";

export function ToggleTema({ className = "" }: { className?: string }) {
  const { tema, alternar } = useTema();
  const escuro = tema === "dark";

  return (
    <div className={`theme-toggle-switch ${className}`}>
      <label>
        <input
          type="checkbox"
          checked={escuro}
          onChange={alternar}
          aria-label={escuro ? "Alternar para modo claro" : "Alternar para modo escuro"}
        />
        <div className="app">
          <div className="toggle" />
          <div className="names">
            <span className="light flex items-center gap-1">
              <Sun size={13} weight="fill" />
              CLARO
            </span>
            <span className="dark flex items-center gap-1">
              <Moon size={13} weight="fill" />
              ESCURO
            </span>
          </div>
        </div>
      </label>
    </div>
  );
}
