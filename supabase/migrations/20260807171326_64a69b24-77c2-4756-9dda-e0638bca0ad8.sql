-- 1. Papéis
CREATE TYPE public.app_role AS ENUM ('gestor', 'gerente_equipe');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  equipe_id uuid REFERENCES public.equipes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_roles_unico ON public.user_roles (user_id, role, COALESCE(equipe_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Funções de apoio
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'gestor')
$$;

CREATE OR REPLACE FUNCTION public.pode_equipe(_user_id uuid, _equipe_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_gestor(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.user_roles
       WHERE user_id = _user_id AND equipe_id IS NOT NULL AND equipe_id = _equipe_id
     )
$$;

CREATE OR REPLACE FUNCTION public.pode_consultor(_user_id uuid, _consultor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_gestor(_user_id)
     OR EXISTS (
       SELECT 1
       FROM public.consultores c
       JOIN public.user_roles ur ON ur.user_id = _user_id AND ur.equipe_id = c.equipe_id
       WHERE c.id = _consultor_id
     )
$$;

-- user_roles: cada um vê o próprio papel; gestor vê todos
CREATE POLICY user_roles_self ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_gestor(auth.uid()));

-- 3. Jornadas por equipe do consultor
DROP POLICY IF EXISTS jornadas_open ON public.jornadas;
CREATE POLICY jornadas_select ON public.jornadas FOR SELECT TO authenticated
  USING (public.pode_consultor(auth.uid(), consultor_id));
CREATE POLICY jornadas_insert ON public.jornadas FOR INSERT TO authenticated
  WITH CHECK (public.pode_consultor(auth.uid(), consultor_id));
CREATE POLICY jornadas_update ON public.jornadas FOR UPDATE TO authenticated
  USING (public.pode_consultor(auth.uid(), consultor_id))
  WITH CHECK (public.pode_consultor(auth.uid(), consultor_id));
CREATE POLICY jornadas_delete ON public.jornadas FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

-- 4. Registros diários por equipe do consultor
DROP POLICY IF EXISTS registros_read ON public.registros_diarios;
DROP POLICY IF EXISTS registros_insert ON public.registros_diarios;
DROP POLICY IF EXISTS registros_update ON public.registros_diarios;
CREATE POLICY registros_select ON public.registros_diarios FOR SELECT TO authenticated
  USING (public.pode_consultor(auth.uid(), consultor_id));
CREATE POLICY registros_insert ON public.registros_diarios FOR INSERT TO authenticated
  WITH CHECK (public.pode_consultor(auth.uid(), consultor_id));
CREATE POLICY registros_update ON public.registros_diarios FOR UPDATE TO authenticated
  USING (public.pode_consultor(auth.uid(), consultor_id))
  WITH CHECK (public.pode_consultor(auth.uid(), consultor_id));

-- 5. Metas: por equipe ou pela equipe do consultor
DROP POLICY IF EXISTS metas_open ON public.metas;
CREATE POLICY metas_select ON public.metas FOR SELECT TO authenticated
  USING (
    public.is_gestor(auth.uid())
    OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id))
    OR (consultor_id IS NOT NULL AND public.pode_consultor(auth.uid(), consultor_id))
  );
CREATE POLICY metas_insert ON public.metas FOR INSERT TO authenticated
  WITH CHECK (
    public.is_gestor(auth.uid())
    OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id))
    OR (consultor_id IS NOT NULL AND public.pode_consultor(auth.uid(), consultor_id))
  );
CREATE POLICY metas_update ON public.metas FOR UPDATE TO authenticated
  USING (
    public.is_gestor(auth.uid())
    OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id))
    OR (consultor_id IS NOT NULL AND public.pode_consultor(auth.uid(), consultor_id))
  )
  WITH CHECK (
    public.is_gestor(auth.uid())
    OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id))
    OR (consultor_id IS NOT NULL AND public.pode_consultor(auth.uid(), consultor_id))
  );
CREATE POLICY metas_delete ON public.metas FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

-- 6. Consultores: leitura geral, escrita por equipe
DROP POLICY IF EXISTS consultores_open ON public.consultores;
CREATE POLICY consultores_select ON public.consultores FOR SELECT TO authenticated USING (true);
CREATE POLICY consultores_insert ON public.consultores FOR INSERT TO authenticated
  WITH CHECK (public.is_gestor(auth.uid()) OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id)));
CREATE POLICY consultores_update ON public.consultores FOR UPDATE TO authenticated
  USING (public.is_gestor(auth.uid()) OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id)))
  WITH CHECK (public.is_gestor(auth.uid()) OR (equipe_id IS NOT NULL AND public.pode_equipe(auth.uid(), equipe_id)));
CREATE POLICY consultores_delete ON public.consultores FOR DELETE TO authenticated
  USING (public.is_gestor(auth.uid()));

-- 7. Listas mestras: leitura geral, escrita só gestor
DROP POLICY IF EXISTS equipes_open ON public.equipes;
CREATE POLICY equipes_select ON public.equipes FOR SELECT TO authenticated USING (true);
CREATE POLICY equipes_write ON public.equipes FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())) WITH CHECK (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS canais_open ON public.canais;
CREATE POLICY canais_select ON public.canais FOR SELECT TO authenticated USING (true);
CREATE POLICY canais_write ON public.canais FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())) WITH CHECK (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS motivos_open ON public.motivos_perda;
CREATE POLICY motivos_select ON public.motivos_perda FOR SELECT TO authenticated USING (true);
CREATE POLICY motivos_write ON public.motivos_perda FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())) WITH CHECK (public.is_gestor(auth.uid()));

DROP POLICY IF EXISTS ciclos_open ON public.ciclos;
CREATE POLICY ciclos_select ON public.ciclos FOR SELECT TO authenticated USING (true);
CREATE POLICY ciclos_write ON public.ciclos FOR ALL TO authenticated
  USING (public.is_gestor(auth.uid())) WITH CHECK (public.is_gestor(auth.uid()));

-- 8. Eventos de jornada seguem a visibilidade da jornada
DROP POLICY IF EXISTS eventos_read ON public.jornada_eventos;
DROP POLICY IF EXISTS eventos_insert ON public.jornada_eventos;
CREATE POLICY eventos_select ON public.jornada_eventos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jornadas j WHERE j.id = jornada_id AND public.pode_consultor(auth.uid(), j.consultor_id)));
CREATE POLICY eventos_insert ON public.jornada_eventos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.jornadas j WHERE j.id = jornada_id AND public.pode_consultor(auth.uid(), j.consultor_id)));