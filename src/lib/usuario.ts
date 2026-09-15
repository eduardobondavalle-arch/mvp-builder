import { currentActor } from "@/fechamento/host";
export function getUsuario() {
  return currentActor().name;
}
export function setUsuario(_nome: string) {
  /* Identidade pertence ao hospedeiro. */
}
export function limparUsuario() {
  /* Sessão pertence ao hospedeiro. */
}
