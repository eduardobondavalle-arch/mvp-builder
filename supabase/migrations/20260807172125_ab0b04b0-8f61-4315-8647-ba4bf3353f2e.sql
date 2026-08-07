-- Remove políticas permissivas herdadas que anulavam o escopo por equipe
DROP POLICY IF EXISTS jornadas_auth ON public.jornadas;
DROP POLICY IF EXISTS registros_read_auth ON public.registros_diarios;
DROP POLICY IF EXISTS registros_insert_auth ON public.registros_diarios;
DROP POLICY IF EXISTS registros_update_auth ON public.registros_diarios;
DROP POLICY IF EXISTS metas_auth ON public.metas;
DROP POLICY IF EXISTS eventos_read_auth ON public.jornada_eventos;
DROP POLICY IF EXISTS eventos_insert_auth ON public.jornada_eventos;
DROP POLICY IF EXISTS consultores_auth ON public.consultores;
DROP POLICY IF EXISTS equipes_auth ON public.equipes;
DROP POLICY IF EXISTS canais_auth ON public.canais;
DROP POLICY IF EXISTS ciclos_auth ON public.ciclos;
DROP POLICY IF EXISTS motivos_perda_auth ON public.motivos_perda;

-- Leitura de listas mestras para navegação (somente leitura)
DROP POLICY IF EXISTS equipes_read ON public.equipes;
CREATE POLICY equipes_read ON public.equipes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS consultores_read ON public.consultores;
CREATE POLICY consultores_read ON public.consultores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS canais_read ON public.canais;
CREATE POLICY canais_read ON public.canais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ciclos_read ON public.ciclos;
CREATE POLICY ciclos_read ON public.ciclos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS motivos_read ON public.motivos_perda;
CREATE POLICY motivos_read ON public.motivos_perda FOR SELECT TO authenticated USING (true);

-- Auditoria: leitura restrita a gestores
DROP POLICY IF EXISTS auditoria_read_auth ON public.auditoria;
DROP POLICY IF EXISTS auditoria_read_gestor ON public.auditoria;
CREATE POLICY auditoria_read_gestor ON public.auditoria FOR SELECT TO authenticated
  USING (public.is_gestor(auth.uid()));