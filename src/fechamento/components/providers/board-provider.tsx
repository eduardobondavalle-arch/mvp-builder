import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { createInitialData, type AppData } from "../../domain/types";
import type { Command } from "../../domain/operations";
import { loadData, sendCommand, subscribe } from "../../persistence/repository";
import { currentActor } from "../../host";

type Context = {
  data: AppData;
  ready: boolean;
  pending: boolean;
  now: number;
  mutate: (command: Command, success?: string) => Promise<AppData | null>;
  notify: (message: string, kind?: "success" | "error") => void;
};
const BoardContext = createContext<Context | null>(null);
export function BoardProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(createInitialData);
  const dataRef = useRef(data);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(Date.now);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const replace = useCallback((next: AppData) => {
    if (next.revision >= dataRef.current.revision) {
      dataRef.current = next;
      setData(next);
    }
  }, []);
  const reload = useCallback(async () => {
    try {
      replace(await loadData());
      setError("");
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar os dados.");
    }
  }, [replace]);
  useEffect(() => {
    void reload();
    return subscribe(() => void reload());
  }, [reload]);
  const mutate = useCallback(
    (command: Command, success?: string): Promise<AppData | null> => {
      const work = async () => {
        setPending(true);
        try {
          const next = await sendCommand(command, dataRef.current.revision);
          replace(next);
          if (success) toast.success(success);
          return next;
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
          await reload();
          return null;
        } finally {
          setPending(false);
        }
      };
      const result = queue.current.then(work, work);
      queue.current = result;
      return result;
    },
    [reload, replace],
  );
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      void mutate({ type: "tick" });
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [mutate]);
  if (error)
    return (
      <div role="alert" className="panel p-6">
        <p>{error}</p>
        <button className="button-secondary mt-4" onClick={() => void reload()}>
          Tentar novamente
        </button>
      </div>
    );
  if (!ready)
    return (
      <div className="grid grid-cols-3 gap-3" aria-label="Carregando fechamentos">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-96 animate-pulse rounded-2xl bg-secondary" />
        ))}
      </div>
    );
  if (!currentActor().permissions.includes("read"))
    return <div className="empty-box">Acesso não autorizado pela plataforma.</div>;
  return (
    <BoardContext.Provider
      value={{
        data,
        ready,
        pending,
        now,
        mutate,
        notify: (message, kind = "success") => toast[kind](message),
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}
export function useBoard() {
  const value = useContext(BoardContext);
  if (!value) throw new Error("BoardProvider ausente.");
  return value;
}
