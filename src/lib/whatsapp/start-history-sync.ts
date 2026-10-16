import type { SupabaseClient } from '@supabase/supabase-js'

import { decrypt } from '@/lib/whatsapp/encryption'
import { startSMBAppDataSync } from '@/lib/whatsapp/meta-api'

export type HistorySyncState =
  | 'not_started'
  | 'requesting'
  | 'requested'
  | 'syncing'
  | 'completed'
  | 'declined'
  | 'failed'

export interface HistorySyncResult {
  state: HistorySyncState
  progress: number
  requestId: string | null
  error?: string
}

interface WhatsAppConfig {
  id: string
  status: string
  phone_number_id: string
  access_token: string
  smb_history_sync_status: HistorySyncState
  smb_history_sync_progress: number | null
  smb_history_sync_request_id: string | null
}

const START_FAILURE = 'Could not start WhatsApp Business app history sync.'

function syncResult(config: WhatsAppConfig): HistorySyncResult {
  return {
    state: config.smb_history_sync_status,
    progress: config.smb_history_sync_progress ?? 0,
    requestId: config.smb_history_sync_request_id,
    ...(config.smb_history_sync_status === 'failed'
      ? { error: START_FAILURE }
      : {}),
  }
}

export async function startCoexistenceHistorySync(
  supabase: SupabaseClient,
  accountId: string
): Promise<HistorySyncResult> {
  const { data: config, error: lookupError } = await supabase
    .from('whatsapp_config')
    .select(
      'id, status, phone_number_id, access_token, smb_history_sync_status, smb_history_sync_progress, smb_history_sync_request_id'
    )
    .eq('account_id', accountId)
    .maybeSingle()

  if (lookupError) {
    console.error('[history-sync] Failed to load WhatsApp configuration:', lookupError)
    throw new Error('Could not load the WhatsApp configuration.')
  }
  if (!config || config.status !== 'connected') {
    throw new Error('Connect the WhatsApp Business app before syncing history.')
  }

  const current = config as WhatsAppConfig
  if (current.smb_history_sync_status !== 'not_started') {
    return syncResult(current)
  }

  const { data: claimed, error: claimError } = await supabase
    .from('whatsapp_config')
    .update({
      smb_history_sync_status: 'requesting',
      smb_history_sync_progress: 0,
      smb_history_sync_error: null,
    })
    .eq('id', current.id)
    .eq('smb_history_sync_status', 'not_started')
    .select(
      'id, status, phone_number_id, access_token, smb_history_sync_status, smb_history_sync_progress, smb_history_sync_request_id'
    )
    .maybeSingle()

  if (claimError) {
    console.error('[history-sync] Failed to claim the one-time sync:', claimError)
    throw new Error('Could not prepare the WhatsApp history sync.')
  }

  if (!claimed) {
    const { data: latest, error: latestError } = await supabase
      .from('whatsapp_config')
      .select(
        'id, status, phone_number_id, access_token, smb_history_sync_status, smb_history_sync_progress, smb_history_sync_request_id'
      )
      .eq('id', current.id)
      .maybeSingle()

    if (latestError || !latest) {
      console.error(
        '[history-sync] Failed to read the current sync state:',
        latestError
      )
      throw new Error('Could not read the WhatsApp history sync state.')
    }
    return syncResult(latest as WhatsAppConfig)
  }

  let result: { requestId: string }
  try {
    const accessToken = decrypt((claimed as WhatsAppConfig).access_token)
    result = await startSMBAppDataSync({
      phoneNumberId: (claimed as WhatsAppConfig).phone_number_id,
      accessToken,
      syncType: 'history',
    })
  } catch (error) {
    console.error('[history-sync] Meta rejected the history sync request:', error)
    const { error: failureUpdateError } = await supabase
      .from('whatsapp_config')
      .update({
        smb_history_sync_status: 'failed',
        smb_history_sync_error: START_FAILURE,
      })
      .eq('id', current.id)
      .eq('smb_history_sync_status', 'requesting')

    if (failureUpdateError) {
      console.error(
        '[history-sync] Could not save the failed sync state:',
        failureUpdateError
      )
    }

    return {
      state: 'failed',
      progress: 0,
      requestId: null,
      error: START_FAILURE,
    }
  }

  const { error: requestUpdateError } = await supabase
    .from('whatsapp_config')
    .update({
      smb_history_sync_request_id: result.requestId,
      smb_history_sync_requested_at: new Date().toISOString(),
    })
    .eq('id', current.id)

  if (requestUpdateError) {
    console.error(
      '[history-sync] Meta accepted the request, but saving its request ID failed:',
      result.requestId,
      requestUpdateError
    )
    return {
      state: 'requesting',
      progress: (claimed as WhatsAppConfig).smb_history_sync_progress ?? 0,
      requestId: result.requestId,
    }
  }

  const { data: latest, error: latestError } = await supabase
    .from('whatsapp_config')
    .select(
      'id, status, phone_number_id, access_token, smb_history_sync_status, smb_history_sync_progress, smb_history_sync_request_id'
    )
    .eq('id', current.id)
    .maybeSingle()

  if (latestError || !latest) {
    console.error(
      '[history-sync] Meta accepted the request, but reading its state failed:',
      latestError
    )
    return {
      state: 'requesting',
      progress: 0,
      requestId: result.requestId,
    }
  }

  const latestConfig = latest as WhatsAppConfig
  if (latestConfig.smb_history_sync_status === 'requesting') {
    const state =
      (latestConfig.smb_history_sync_progress ?? 0) >= 100
        ? 'completed'
        : (latestConfig.smb_history_sync_progress ?? 0) > 0
          ? 'syncing'
          : 'requested'
    const { error: stateUpdateError } = await supabase
      .from('whatsapp_config')
      .update({ smb_history_sync_status: state })
      .eq('id', current.id)
      .eq('smb_history_sync_status', 'requesting')

    if (stateUpdateError) {
      console.error(
        '[history-sync] Could not update the accepted sync state:',
        stateUpdateError
      )
    } else {
      latestConfig.smb_history_sync_status = state
    }
  }

  return syncResult({
    ...latestConfig,
    smb_history_sync_request_id: result.requestId,
  })
}