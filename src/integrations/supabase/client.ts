import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { platform } from "@/fechamento/host";
import { localCommercialClient } from "@/fechamento/persistence/commercial-client";
/** Cliente fornecido pela plataforma; ambiente local abre sem login. */
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(_target, key) {
    const client = platform()?.commercialClient ?? localCommercialClient;
    const value = Reflect.get(client, key);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
