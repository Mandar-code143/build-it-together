-- ============ roles ============
CREATE TYPE public.app_role AS ENUM ('admin','operator','viewer');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_operate(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','operator'))
$$;

CREATE POLICY "roles readable by authenticated" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- first operator to sign up becomes admin, everyone else viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)));
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ groups ============
CREATE TABLE public.node_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.node_groups TO authenticated;
GRANT ALL ON public.node_groups TO service_role;
ALTER TABLE public.node_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups readable" ON public.node_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators write groups" ON public.node_groups FOR INSERT TO authenticated WITH CHECK (public.can_operate(auth.uid()));
CREATE POLICY "operators update groups" ON public.node_groups FOR UPDATE TO authenticated USING (public.can_operate(auth.uid()));
CREATE POLICY "admins delete groups" ON public.node_groups FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER node_groups_touch BEFORE UPDATE ON public.node_groups FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ nodes ============
CREATE TYPE public.node_status AS ENUM ('enrolling','online','degraded','offline','recovering','unknown','disabled');

CREATE TABLE public.nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hostname text NOT NULL,
  display_name text,
  environment text NOT NULL DEFAULT 'production',
  os text,
  os_version text,
  kernel text,
  architecture text,
  address text,
  status public.node_status NOT NULL DEFAULT 'enrolling',
  agent_version text,
  protocol_version text,
  fingerprint text,
  group_id uuid REFERENCES public.node_groups(id) ON DELETE SET NULL,
  labels jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  node_exporter_port integer NOT NULL DEFAULT 9100,
  heartbeat_interval_seconds integer NOT NULL DEFAULT 15,
  is_simulated boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  boot_time timestamptz,
  last_heartbeat_at timestamptz,
  last_metrics_at timestamptz,
  registered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hostname, environment)
);
CREATE INDEX nodes_status_idx ON public.nodes (status);
CREATE INDEX nodes_group_idx ON public.nodes (group_id);
CREATE INDEX nodes_heartbeat_idx ON public.nodes (last_heartbeat_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nodes TO authenticated;
GRANT ALL ON public.nodes TO service_role;
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nodes readable" ON public.nodes FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators insert nodes" ON public.nodes FOR INSERT TO authenticated WITH CHECK (public.can_operate(auth.uid()));
CREATE POLICY "operators update nodes" ON public.nodes FOR UPDATE TO authenticated USING (public.can_operate(auth.uid()));
CREATE POLICY "admins delete nodes" ON public.nodes FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER nodes_touch BEFORE UPDATE ON public.nodes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- agent credentials: server only
CREATE TABLE public.node_secrets (
  node_id uuid PRIMARY KEY REFERENCES public.nodes(id) ON DELETE CASCADE,
  agent_key_hash text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX node_secrets_hash_idx ON public.node_secrets (agent_key_hash);
GRANT ALL ON public.node_secrets TO service_role;
ALTER TABLE public.node_secrets ENABLE ROW LEVEL SECURITY;

-- ============ enrollment tokens ============
CREATE TABLE public.enrollment_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  token_prefix text NOT NULL,
  label text,
  environment text NOT NULL DEFAULT 'production',
  group_id uuid REFERENCES public.node_groups(id) ON DELETE SET NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  revoked_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.enrollment_tokens TO authenticated;
GRANT ALL ON public.enrollment_tokens TO service_role;
ALTER TABLE public.enrollment_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tokens readable" ON public.enrollment_tokens FOR SELECT TO authenticated USING (public.can_operate(auth.uid()));
CREATE POLICY "operators create tokens" ON public.enrollment_tokens FOR INSERT TO authenticated WITH CHECK (public.can_operate(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "operators revoke tokens" ON public.enrollment_tokens FOR UPDATE TO authenticated USING (public.can_operate(auth.uid()));

-- ============ heartbeats / metric snapshots ============
CREATE TABLE public.heartbeats (
  id bigserial PRIMARY KEY,
  node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  cpu_percent numeric,
  memory_percent numeric,
  memory_total_bytes bigint,
  memory_used_bytes bigint,
  disk_percent numeric,
  disk_total_bytes bigint,
  disk_used_bytes bigint,
  load1 numeric,
  load5 numeric,
  load15 numeric,
  uptime_seconds bigint,
  net_rx_bytes bigint,
  net_tx_bytes bigint,
  reported_health text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX heartbeats_node_time_idx ON public.heartbeats (node_id, received_at DESC);
GRANT SELECT ON public.heartbeats TO authenticated;
GRANT ALL ON public.heartbeats TO service_role;
ALTER TABLE public.heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "heartbeats readable" ON public.heartbeats FOR SELECT TO authenticated USING (true);

-- ============ commands ============
CREATE TYPE public.command_status AS ENUM ('queued','dispatched','running','succeeded','failed','timed_out','cancelled','rejected');

CREATE TABLE public.commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.nodes(id) ON DELETE CASCADE,
  action text NOT NULL,
  args jsonb NOT NULL DEFAULT '[]'::jsonb,
  status public.command_status NOT NULL DEFAULT 'queued',
  idempotency_key text NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  timeout_seconds integer NOT NULL DEFAULT 60,
  attempt integer NOT NULL DEFAULT 0,
  exit_code integer,
  stdout text,
  stderr text,
  error text,
  duration_ms integer,
  queued_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (node_id, idempotency_key)
);
CREATE INDEX commands_node_idx ON public.commands (node_id, queued_at DESC);
CREATE INDEX commands_status_idx ON public.commands (status);
GRANT SELECT, INSERT, UPDATE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commands readable" ON public.commands FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators queue commands" ON public.commands FOR INSERT TO authenticated WITH CHECK (public.can_operate(auth.uid()) AND requested_by = auth.uid());
CREATE POLICY "operators update commands" ON public.commands FOR UPDATE TO authenticated USING (public.can_operate(auth.uid()));
CREATE TRIGGER commands_touch BEFORE UPDATE ON public.commands FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ alerts ============
CREATE TABLE public.alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid REFERENCES public.nodes(id) ON DELETE CASCADE,
  severity text NOT NULL DEFAULT 'warning',
  rule text NOT NULL,
  summary text NOT NULL,
  detail text,
  state text NOT NULL DEFAULT 'firing',
  started_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz
);
CREATE INDEX alerts_state_idx ON public.alerts (state, started_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.alerts TO authenticated;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts readable" ON public.alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "operators ack alerts" ON public.alerts FOR UPDATE TO authenticated USING (public.can_operate(auth.uid()));

-- ============ audit ============
CREATE TABLE public.audit_logs (
  id bigserial PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label text,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_time_idx ON public.audit_logs (occurred_at DESC);
CREATE INDEX audit_action_idx ON public.audit_logs (action);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.audit_logs_id_seq TO authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit readable" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated append audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- availability evaluation: derive state from heartbeat freshness
CREATE OR REPLACE FUNCTION public.evaluate_node_availability()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.nodes n SET status = 'offline'
  WHERE n.enabled
    AND n.status IN ('online','degraded','recovering')
    AND (n.last_heartbeat_at IS NULL OR n.last_heartbeat_at < now() - make_interval(secs => greatest(n.heartbeat_interval_seconds,5) * 4));

  INSERT INTO public.alerts (node_id, severity, rule, summary, detail)
  SELECT n.id, 'critical', 'NodeOffline', n.hostname || ' is offline', 'No heartbeat within the failure threshold.'
  FROM public.nodes n
  WHERE n.status = 'offline' AND n.enabled
    AND NOT EXISTS (
      SELECT 1 FROM public.alerts a WHERE a.node_id = n.id AND a.rule = 'NodeOffline' AND a.state = 'firing'
    );

  UPDATE public.alerts a SET state = 'resolved', resolved_at = now()
  WHERE a.rule = 'NodeOffline' AND a.state = 'firing'
    AND EXISTS (SELECT 1 FROM public.nodes n WHERE n.id = a.node_id AND n.status IN ('online','degraded','recovering'));
END;
$$;
GRANT EXECUTE ON FUNCTION public.evaluate_node_availability() TO authenticated, service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;