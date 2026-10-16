-- Track the one-time history synchronization request and Meta webhook progress.
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS smb_history_sync_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS smb_history_sync_progress INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS smb_history_sync_request_id TEXT,
  ADD COLUMN IF NOT EXISTS smb_history_sync_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS smb_history_sync_error TEXT;

ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_smb_history_sync_status_check;

ALTER TABLE whatsapp_config
  ADD CONSTRAINT whatsapp_config_smb_history_sync_status_check
  CHECK (smb_history_sync_status IN (
    'not_started',
    'requesting',
    'requested',
    'syncing',
    'completed',
    'declined',
    'failed'
  ));

ALTER TABLE whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_smb_history_sync_progress_check;

ALTER TABLE whatsapp_config
  ADD CONSTRAINT whatsapp_config_smb_history_sync_progress_check
  CHECK (smb_history_sync_progress BETWEEN 0 AND 100);