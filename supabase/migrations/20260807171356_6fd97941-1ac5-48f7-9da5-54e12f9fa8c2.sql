REVOKE ALL ON FUNCTION public.is_gestor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_equipe(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pode_consultor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_gestor(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_equipe(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_consultor(uuid, uuid) TO authenticated, service_role;