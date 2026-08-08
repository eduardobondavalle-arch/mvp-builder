-- 1) Harden SECURITY DEFINER helper functions: they may only report on the caller
CREATE OR REPLACE FUNCTION public.is_gestor(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'gestor')
  END
$$;

CREATE OR REPLACE FUNCTION public.pode_equipe(_user_id uuid, _equipe_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.is_gestor(_user_id) OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND equipe_id IS NOT NULL AND equipe_id = _equipe_id
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.pode_consultor(_user_id uuid, _consultor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE public.is_gestor(_user_id) OR EXISTS (
      SELECT 1
      FROM public.consultores c
      JOIN public.user_roles ur ON ur.user_id = _user_id AND ur.equipe_id = c.equipe_id
      WHERE c.id = _consultor_id
    )
  END
$$;

REVOKE ALL ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_equipe(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_consultor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_equipe(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_consultor(uuid, uuid) TO authenticated, service_role;

-- 2) Audit log author is forced server-side, never taken from the client
CREATE OR REPLACE FUNCTION public.auditoria_set_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória para registrar auditoria';
  END IF;
  NEW.usuario := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), auth.uid()::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auditoria_set_usuario ON public.auditoria;
CREATE TRIGGER auditoria_set_usuario
  BEFORE INSERT ON public.auditoria
  FOR EACH ROW EXECUTE FUNCTION public.auditoria_set_usuario();

DROP POLICY IF EXISTS auditoria_insert_self ON public.auditoria;
CREATE POLICY auditoria_insert_self ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3) Journey event trail is explicitly append-only
REVOKE UPDATE, DELETE, TRUNCATE ON public.jornada_eventos FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.jornada_eventos FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.auditoria FROM authenticated;
REVOKE UPDATE, DELETE, TRUNCATE ON public.auditoria FROM anon;
GRANT SELECT, INSERT ON public.jornada_eventos TO authenticated;
GRANT SELECT, INSERT ON public.auditoria TO authenticated;