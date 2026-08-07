-- Revoke anon access on all app tables
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['auditoria','canais','ciclos','consultores','equipes','jornada_eventos','jornadas','metas','motivos_perda','motivos_transferencia','pre_leads_diarios','registros_diarios'])
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Drop old open/anon policies
DROP POLICY IF EXISTS auditoria_insert ON public.auditoria;
DROP POLICY IF EXISTS auditoria_read ON public.auditoria;
DROP POLICY IF EXISTS canais_open ON public.canais;
DROP POLICY IF EXISTS ciclos_open ON public.ciclos;
DROP POLICY IF EXISTS consultores_open ON public.consultores;
DROP POLICY IF EXISTS equipes_open ON public.equipes;
DROP POLICY IF EXISTS eventos_insert ON public.jornada_eventos;
DROP POLICY IF EXISTS eventos_read ON public.jornada_eventos;
DROP POLICY IF EXISTS jornadas_open ON public.jornadas;
DROP POLICY IF EXISTS metas_open ON public.metas;
DROP POLICY IF EXISTS motivos_open ON public.motivos_perda;
DROP POLICY IF EXISTS motivos_transf_insert ON public.motivos_transferencia;
DROP POLICY IF EXISTS motivos_transf_read ON public.motivos_transferencia;
DROP POLICY IF EXISTS motivos_transf_update ON public.motivos_transferencia;
DROP POLICY IF EXISTS pre_leads_insert ON public.pre_leads_diarios;
DROP POLICY IF EXISTS pre_leads_read ON public.pre_leads_diarios;
DROP POLICY IF EXISTS pre_leads_update ON public.pre_leads_diarios;
DROP POLICY IF EXISTS registros_insert ON public.registros_diarios;
DROP POLICY IF EXISTS registros_read ON public.registros_diarios;
DROP POLICY IF EXISTS registros_update ON public.registros_diarios;

-- Full access for authenticated users (master data + journeys + goals)
CREATE POLICY canais_auth ON public.canais FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY ciclos_auth ON public.ciclos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY consultores_auth ON public.consultores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY equipes_auth ON public.equipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY jornadas_auth ON public.jornadas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY metas_auth ON public.metas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY motivos_perda_auth ON public.motivos_perda FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Append-only / no-delete tables
CREATE POLICY auditoria_read_auth ON public.auditoria FOR SELECT TO authenticated USING (true);
CREATE POLICY auditoria_insert_auth ON public.auditoria FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY eventos_read_auth ON public.jornada_eventos FOR SELECT TO authenticated USING (true);
CREATE POLICY eventos_insert_auth ON public.jornada_eventos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY motivos_transf_read_auth ON public.motivos_transferencia FOR SELECT TO authenticated USING (true);
CREATE POLICY motivos_transf_insert_auth ON public.motivos_transferencia FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY motivos_transf_update_auth ON public.motivos_transferencia FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY pre_leads_read_auth ON public.pre_leads_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY pre_leads_insert_auth ON public.pre_leads_diarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY pre_leads_update_auth ON public.pre_leads_diarios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY registros_read_auth ON public.registros_diarios FOR SELECT TO authenticated USING (true);
CREATE POLICY registros_insert_auth ON public.registros_diarios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY registros_update_auth ON public.registros_diarios FOR UPDATE TO authenticated USING (true) WITH CHECK (true);