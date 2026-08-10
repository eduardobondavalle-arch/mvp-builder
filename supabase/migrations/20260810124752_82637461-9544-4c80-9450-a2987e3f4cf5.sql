-- 1) Trigger-only SECURITY DEFINER / helper functions: not callable by API users
REVOKE ALL ON FUNCTION public.auditoria_set_usuario() FROM authenticated, anon, PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated, anon, PUBLIC;

-- 2) pre_leads_diarios: restrict writes to gestor
DROP POLICY IF EXISTS pre_leads_insert_auth ON public.pre_leads_diarios;
DROP POLICY IF EXISTS pre_leads_update_auth ON public.pre_leads_diarios;

CREATE POLICY pre_leads_insert_gestor ON public.pre_leads_diarios
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor(auth.uid()));

CREATE POLICY pre_leads_update_gestor ON public.pre_leads_diarios
  FOR UPDATE TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

CREATE POLICY pre_leads_delete_gestor ON public.pre_leads_diarios
  FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

-- 3) registros_diarios: scoped delete
CREATE POLICY registros_delete ON public.registros_diarios
  FOR DELETE TO authenticated
  USING (public.pode_consultor(auth.uid(), consultor_id));

-- 4) jornada_eventos: gestor-only correction/removal
CREATE POLICY eventos_update_gestor ON public.jornada_eventos
  FOR UPDATE TO authenticated
  USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

CREATE POLICY eventos_delete_gestor ON public.jornada_eventos
  FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

GRANT DELETE ON public.pre_leads_diarios TO authenticated;
GRANT DELETE ON public.registros_diarios TO authenticated;
GRANT UPDATE, DELETE ON public.jornada_eventos TO authenticated;