DROP POLICY IF EXISTS motivos_transf_insert_auth ON public.motivos_transferencia;
DROP POLICY IF EXISTS motivos_transf_update_auth ON public.motivos_transferencia;
CREATE POLICY motivos_transf_insert_gestor ON public.motivos_transferencia
  FOR INSERT TO authenticated WITH CHECK (public.is_gestor(auth.uid()));
CREATE POLICY motivos_transf_update_gestor ON public.motivos_transferencia
  FOR UPDATE TO authenticated USING (public.is_gestor(auth.uid()))
  WITH CHECK (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS auditoria_insert_auth ON public.auditoria;
CREATE POLICY auditoria_insert_self ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (usuario = coalesce(auth.jwt() ->> 'email', ''));