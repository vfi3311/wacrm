-- ============================================================
-- 047_whatsapp_embedded_signup_settings.sql
--
-- Persist the Meta embedded-signup app values in the same account-scoped
-- WhatsApp settings row used by the dashboard. This lets admins finish the
-- setup directly from the app instead of editing server env vars by hand.
-- ============================================================

ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS meta_app_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_embedded_signup_config_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_embedded_signup_app_secret TEXT;

COMMENT ON COLUMN whatsapp_config.meta_app_id IS 'Meta App ID for the embedded signup flow';
COMMENT ON COLUMN whatsapp_config.meta_embedded_signup_config_id IS 'Meta Embedded Signup config ID';
COMMENT ON COLUMN whatsapp_config.meta_embedded_signup_app_secret IS 'Encrypted Meta App Secret used for the embedded signup exchange';
