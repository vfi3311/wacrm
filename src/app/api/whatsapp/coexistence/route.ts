import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/translate';
import { canEditSettings, isAccountRole } from '@/lib/auth/roles';
import { encrypt, isEncryptedFormat } from '@/lib/whatsapp/encryption';
import {
  applyMetaSignupSettingsToProcessEnv,
  resolveMetaSignupSettings,
} from '@/lib/whatsapp/meta-signup-config';

const t = getT('Api');

function isMissingMetaSettingsColumn(error: {
  code?: string;
  message?: string;
}) {
  return (
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    (error.message?.includes('meta_embedded_signup_app_secret') ?? false) ||
    (error.message?.includes('meta_embedded_signup_config_id') ?? false) ||
    (error.message?.includes('meta_app_id') ?? false) ||
    (error.message?.includes('smb_history_sync_') ?? false)
  );
}

function databaseErrorResponse(error: { code?: string; message?: string }) {
  if (isMissingMetaSettingsColumn(error)) {
    return NextResponse.json(
      { error: t('whatsappCoexistence.migrationRequired') },
      { status: 503 }
    );
  }
  return NextResponse.json(
    { error: t('common.internalServerError') },
    { status: 500 }
  );
}

/**
 * Return only the public identifiers needed by Meta's browser SDK.
 * The app secret is intentionally never exposed to the client.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: t('common.unauthorized') },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle();
    if (profileError) {
      console.error(
        '[whatsapp/coexistence] Failed to resolve account:',
        profileError
      );
      return NextResponse.json(
        { error: t('common.internalServerError') },
        { status: 500 }
      );
    }
    if (!profile?.account_id) {
      return NextResponse.json(
        { error: t('common.profileNotLinked') },
        { status: 403 }
      );
    }

    const { data: whatsappConfig, error: configError } = await supabase
      .from('whatsapp_config')
      .select(
        'status, meta_app_id, meta_embedded_signup_config_id, meta_embedded_signup_app_secret, smb_history_sync_status, smb_history_sync_progress, smb_history_sync_request_id'
      )
      .eq('account_id', profile.account_id)
      .maybeSingle();
    if (configError) {
      console.error(
        '[whatsapp/coexistence] Failed to load WhatsApp status:',
        configError
      );
      return databaseErrorResponse(configError);
    }

    const storedAppSecret =
      whatsappConfig?.meta_embedded_signup_app_secret ?? null;
    if (
      storedAppSecret &&
      !isEncryptedFormat(storedAppSecret) &&
      isAccountRole(profile.account_role) &&
      canEditSettings(profile.account_role)
    ) {
      const { error: encryptionError } = await supabase
        .from('whatsapp_config')
        .update({
          meta_embedded_signup_app_secret: encrypt(storedAppSecret),
          updated_at: new Date().toISOString(),
        })
        .eq('account_id', profile.account_id);

      if (encryptionError) {
        console.error(
          '[whatsapp/coexistence] Failed to encrypt the saved Meta App Secret:',
          encryptionError
        );
        return NextResponse.json(
          { error: t('common.internalServerError') },
          { status: 500 }
        );
      }
    }

    const resolvedSettings = resolveMetaSignupSettings(whatsappConfig ?? null);

    return NextResponse.json({
      configured: resolvedSettings.configured,
      connected: whatsappConfig?.status === 'connected',
      appId: resolvedSettings.appId || null,
      configId: resolvedSettings.configId || null,
      hasAppSecret: Boolean(resolvedSettings.appSecret),
      historySync: whatsappConfig
        ? {
            state: whatsappConfig.smb_history_sync_status,
            progress: whatsappConfig.smb_history_sync_progress,
            requestId: whatsappConfig.smb_history_sync_request_id,
          }
        : null,
    });
  } catch (error) {
    console.error(
      '[whatsapp/coexistence] Failed to load Meta configuration:',
      error
    );
    return NextResponse.json(
      { error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: t('common.unauthorized') },
        { status: 401 }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('account_id, account_role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        '[whatsapp/coexistence] Failed to resolve account permissions:',
        profileError
      );
      return NextResponse.json(
        { error: t('common.internalServerError') },
        { status: 500 }
      );
    }

    if (!profile?.account_id) {
      return NextResponse.json(
        { error: t('common.profileNotLinked') },
        { status: 403 }
      );
    }

    if (
      !isAccountRole(profile.account_role) ||
      !canEditSettings(profile.account_role)
    ) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.adminRequired') },
        { status: 403 }
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const appId =
      typeof body.meta_app_id === 'string' ? body.meta_app_id.trim() : '';
    const configId =
      typeof body.meta_embedded_signup_config_id === 'string'
        ? body.meta_embedded_signup_config_id.trim()
        : '';
    const appSecret =
      typeof body.meta_embedded_signup_app_secret === 'string'
        ? body.meta_embedded_signup_app_secret.trim()
        : '';

    if (!appId || !configId) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.metaConfigRequired') },
        { status: 400 }
      );
    }
    if (!/^\d+$/.test(appId) || !/^\d+$/.test(configId)) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.metaIdsNumeric') },
        { status: 400 }
      );
    }
    if (appId === configId) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.metaConfigIdIsAppId') },
        { status: 400 }
      );
    }

    const { data: existingConfig, error: lookupError } = await supabase
      .from('whatsapp_config')
      .select('id, meta_embedded_signup_app_secret')
      .eq('account_id', profile.account_id)
      .maybeSingle();

    if (lookupError) {
      console.error(
        '[whatsapp/coexistence] Failed to load whatsapp_config row:',
        lookupError
      );
      return databaseErrorResponse(lookupError);
    }

    if (!existingConfig) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.noConfigRow') },
        { status: 400 }
      );
    }

    const appSecretToStore =
      appSecret || resolveMetaSignupSettings(existingConfig).appSecret;
    if (!appSecretToStore) {
      return NextResponse.json(
        { error: t('whatsappCoexistence.metaConfigRequired') },
        { status: 400 }
      );
    }

    let encryptedAppSecret: string;
    try {
      encryptedAppSecret = encrypt(appSecretToStore);
    } catch (error) {
      console.error(
        '[whatsapp/coexistence] Failed to encrypt the Meta App Secret:',
        error instanceof Error ? error.message : error
      );
      return NextResponse.json(
        { error: t('whatsappConfig.encryptFailed') },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from('whatsapp_config')
      .update({
        meta_app_id: appId,
        meta_embedded_signup_config_id: configId,
        meta_embedded_signup_app_secret: encryptedAppSecret,
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', profile.account_id);

    if (updateError) {
      console.error(
        '[whatsapp/coexistence] Failed to save Meta config:',
        updateError
      );
      return databaseErrorResponse(updateError);
    }

    applyMetaSignupSettingsToProcessEnv({
      appId,
      configId,
      appSecret: appSecretToStore,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      appId,
      configId,
      hasAppSecret: true,
    });
  } catch (error) {
    console.error(
      '[whatsapp/coexistence] Failed to save Meta configuration:',
      error
    );
    return NextResponse.json(
      { error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}
