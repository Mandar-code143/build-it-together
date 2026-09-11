REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.can_operate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_operate(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.evaluate_node_availability() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.evaluate_node_availability() TO authenticated, service_role;
CREATE POLICY "node secrets are server only" ON public.node_secrets FOR SELECT TO authenticated USING (false);