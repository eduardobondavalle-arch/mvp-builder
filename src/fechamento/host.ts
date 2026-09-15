import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Actor, AppData, Attachment } from "./domain/types";
import type { Command } from "./domain/operations";

/** Instale antes de montar o app. O servidor hospedeiro valida identidade e comandos novamente. */
export interface PlatformAdapter {
  actor: Actor;
  commercialScope?: { companyWide: boolean; unitIds: string[] };
  commercialClient: SupabaseClient<Database>;
  load(): Promise<AppData>;
  execute(command: Command, expectedRevision: number): Promise<AppData>;
  upload(file: File, cardId: string): Promise<Pick<Attachment, "storagePath" | "url">>;
  subscribe?(listener: () => void): () => void;
}
declare global {
  interface Window {
    adimPlatform?: PlatformAdapter;
  }
}
export const platform = () => (typeof window === "undefined" ? undefined : window.adimPlatform);
export const localActor: Actor = {
  id: "local-operation",
  name: "Operação local",
  permissions: ["read", "write", "configure"],
};
export const currentActor = () => platform()?.actor ?? localActor;
