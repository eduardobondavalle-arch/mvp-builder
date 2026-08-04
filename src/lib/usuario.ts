const KEY = "adim.usuario";

export function getUsuario(): string {
  if (typeof window === "undefined") return "Gestão";
  return window.localStorage.getItem(KEY) || "Gestão";
}

export function setUsuario(nome: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, nome.trim() || "Gestão");
}
