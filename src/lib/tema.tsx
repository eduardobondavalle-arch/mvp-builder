import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Tema = "light" | "dark";

const CHAVE = "adim-tema";

const TemaContext = createContext<{ tema: Tema; alternar: () => void }>({
  tema: "light",
  alternar: () => {},
});

function aplicar(tema: Tema) {
  const root = document.documentElement;
  root.classList.toggle("dark", tema === "dark");
  root.style.colorScheme = tema;
}

export function TemaProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    const salvo = localStorage.getItem(CHAVE) as Tema | null;
    const inicial =
      salvo ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTema(inicial);
    aplicar(inicial);
  }, []);

  const alternar = useCallback(() => {
    setTema((atual) => {
      const proximo: Tema = atual === "dark" ? "light" : "dark";
      localStorage.setItem(CHAVE, proximo);
      aplicar(proximo);
      return proximo;
    });
  }, []);

  return <TemaContext.Provider value={{ tema, alternar }}>{children}</TemaContext.Provider>;
}

export function useTema() {
  return useContext(TemaContext);
}
