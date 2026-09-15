import { createInitialData, type AppData } from "../domain/types";
import { execute, type Command } from "../domain/operations";
import { currentActor, platform } from "../host";
import { parseSnapshot } from "./snapshot";

export const STORAGE_KEY = "adim-platform:v1";
export const CHANGE_EVENT = "adim:data-changed";
export function validateSnapshot(input: unknown): AppData {
  return parseSnapshot(input);
}
export function readLocal(): AppData {
  if (typeof window === "undefined") return createInitialData();
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return createInitialData();
  try {
    return validateSnapshot(JSON.parse(raw));
  } catch {
    throw new Error(
      "Não foi possível ler a base local. Os dados foram preservados; recupere o backup antes de continuar.",
    );
  }
}
export function writeLocal(data: AppData) {
  // setItem é atômico: falha de quota mantém a última versão confirmada.
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validateSnapshot(data)));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
let queue: Promise<unknown> = Promise.resolve();
export function localTransaction<T>(
  operation: (current: AppData) => { data: AppData; result: T },
): Promise<T> {
  const work = async () => {
    if (typeof navigator === "undefined" || !navigator.locks?.request)
      throw new Error(
        "Este navegador não oferece bloqueio seguro para gravação local. Use um navegador com Web Locks em HTTPS ou localhost. A base foi preservada.",
      );
    return navigator.locks.request(STORAGE_KEY, () => {
      const previousRaw = window.localStorage.getItem(STORAGE_KEY);
      const source = readLocal();
      const previousRevision = source.revision;
      const previousSnapshot = JSON.stringify(source);
      const { data, result } = operation(source);
      validateSnapshot(data);
      if (window.localStorage.getItem(STORAGE_KEY) !== previousRaw)
        throw new Error("Os dados foram alterados em outra aba. Atualize e tente novamente.");
      if (JSON.stringify(data) === previousSnapshot) return result;
      if (data.revision !== previousRevision + 1)
        throw new Error("Revisão de gravação inválida. Nenhum dado foi alterado.");
      writeLocal(data);
      return result;
    });
  };
  const result = queue.then(work, work);
  queue = result.catch(() => undefined);
  return result;
}
export async function loadData() {
  const adapter = platform();
  return adapter ? validateSnapshot(await adapter.load()) : readLocal();
}
export async function sendCommand(command: Command, expectedRevision: number) {
  const adapter = platform();
  if (adapter) return validateSnapshot(await adapter.execute(command, expectedRevision));
  return localTransaction((source) => {
    if (source.revision !== expectedRevision)
      throw new Error("Os dados foram alterados em outra aba. Atualize e tente novamente.");
    const data = execute(source, command, currentActor());
    return { data, result: data };
  });
}
export function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", storage);
  const unsubscribe = platform()?.subscribe?.(listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", storage);
    unsubscribe?.();
  };
}
