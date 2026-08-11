import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) throw redirect({ to: "/auth" });
      return { user: data.user };
    } catch (e) {
      // Redirecionamentos precisam passar; qualquer falha de rede/token vira volta ao login.
      if (e && typeof e === "object" && ("isRedirect" in e || "to" in e)) throw e;
      throw redirect({ to: "/auth" });
    }
  },

  component: () => <Outlet />,
});
