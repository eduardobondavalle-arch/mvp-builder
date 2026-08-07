const KEY = "adim.usuario";

/** Nome/e-mail registrado na auditoria — preenchido pela sessão autenticada. */
export function getUsuario(): string {
  if (typeof window === "undefined") return "Gestão";
  return window.localStorage.getItem(KEY) || "Gestão";
}

export function setUsuario(nome: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, nome.trim() || "Gestão");
}

export function limparUsuario() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
