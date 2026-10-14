import { decrypt, isEncryptedFormat } from '@/lib/whatsapp/encryption';

export type MetaSignupSettingsSource = {
  meta_app_id?: string | null;
  meta_embedded_signup_config_id?: string | null;
  meta_embedded_signup_app_secret?: string | null;
};

export function resolveMetaSignupSettings(
  source?: MetaSignupSettingsSource | null,
) {
  const appId = (source?.meta_app_id ?? process.env.META_APP_ID ?? '').trim();
  const configId = (
    source?.meta_embedded_signup_config_id ??
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ??
    ''
  ).trim();
  const storedAppSecret = source?.meta_embedded_signup_app_secret?.trim();
  const configuredAppSecret = (
    storedAppSecret ?? process.env.META_EMBEDDED_SIGNUP_APP_SECRET ?? ''
  ).trim();
  const appSecret =
    storedAppSecret && isEncryptedFormat(storedAppSecret)
      ? decrypt(storedAppSecret)
      : configuredAppSecret;

  return {
    appId,
    configId,
    appSecret,
    configured: Boolean(appId && configId && appSecret),
  };
}

export function applyMetaSignupSettingsToProcessEnv(values: {
  appId?: string;
  configId?: string;
  appSecret?: string;
}) {
  if (values.appId !== undefined) {
    process.env.META_APP_ID = values.appId.trim();
  }
  if (values.configId !== undefined) {
    process.env.META_EMBEDDED_SIGNUP_CONFIG_ID = values.configId.trim();
  }
  if (values.appSecret !== undefined) {
    process.env.META_EMBEDDED_SIGNUP_APP_SECRET = values.appSecret.trim();
  }
}
