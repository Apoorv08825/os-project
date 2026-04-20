
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TYPE public.audit_event AS ENUM (
  'signup',
  'login_success',
  'login_failed',
  'logout',
  'mfa_enrolled',
  'mfa_verified',
  'mfa_failed',
  'mfa_disabled',
  'backup_code_used',
  'password_changed',
  'password_reset_requested',
  'role_granted',
  'role_revoked',
  'account_locked',
  'account_unlocked',
  'trusted_device_added',
  'trusted_device_removed',
  'suspicious_login',
  'integrity_check'
);

-- =========================================================
-- SHARED HELPERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- USER ROLES (separate table — prevents privilege escalation)
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security-definer role check (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- =========================================================
-- PASSWORD HISTORY (write-only from server)
-- =========================================================
CREATE TABLE public.password_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_password_history_user ON public.password_history(user_id, created_at DESC);

-- =========================================================
-- TOTP SECRETS
-- =========================================================
CREATE TABLE public.totp_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  enrolled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.totp_secrets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_totp_updated_at
  BEFORE UPDATE ON public.totp_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- BACKUP CODES (hashed, single-use)
-- =========================================================
CREATE TABLE public.backup_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.backup_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_backup_codes_user ON public.backup_codes(user_id);

-- =========================================================
-- EMAIL OTPS
-- =========================================================
CREATE TABLE public.email_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_otps ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_email_otps_user ON public.email_otps(user_id, created_at DESC);

-- =========================================================
-- TRUSTED DEVICES
-- =========================================================
CREATE TABLE public.trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_hash TEXT NOT NULL,
  device_label TEXT,
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trusted_devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_trusted_devices_user ON public.trusted_devices(user_id);

-- =========================================================
-- FAILED LOGINS (server-only)
-- =========================================================
CREATE TABLE public.failed_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.failed_logins ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_failed_logins_email ON public.failed_logins(email, attempted_at DESC);

-- =========================================================
-- AUDIT LOGS
-- =========================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event audit_event NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_event ON public.audit_logs(event);

-- =========================================================
-- INTEGRITY HASHES
-- =========================================================
CREATE TABLE public.integrity_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_name TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integrity_hashes ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- RLS POLICIES
-- =========================================================

-- profiles
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- password_history (no client access; edge functions use service role)
-- (RLS enabled, no policies = locked down)

-- totp_secrets
CREATE POLICY "Users view own totp" ON public.totp_secrets
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own totp" ON public.totp_secrets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own totp" ON public.totp_secrets
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own totp" ON public.totp_secrets
  FOR DELETE USING (auth.uid() = user_id);

-- backup_codes (server writes hashes; users can see their own metadata)
CREATE POLICY "Users view own backup codes" ON public.backup_codes
  FOR SELECT USING (auth.uid() = user_id);

-- email_otps: locked down (server only)

-- trusted_devices
CREATE POLICY "Users view own devices" ON public.trusted_devices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users delete own devices" ON public.trusted_devices
  FOR DELETE USING (auth.uid() = user_id);

-- failed_logins: locked down (server only)

-- audit_logs
CREATE POLICY "Users view own audit logs" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all audit logs" ON public.audit_logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- integrity_hashes
CREATE POLICY "Admins view integrity" ON public.integrity_hashes
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage integrity" ON public.integrity_hashes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- SIGNUP TRIGGER → auto-create profile + default 'user' role
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.audit_logs (user_id, email, event, severity, metadata)
  VALUES (NEW.id, NEW.email, 'signup', 'info', jsonb_build_object('source', 'auth.users trigger'));

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
