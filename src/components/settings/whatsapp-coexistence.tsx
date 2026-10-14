'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Smartphone,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';

interface EmbeddedSignupConfig {
  configured: boolean;
  connected: boolean;
  appId: string | null;
  configId: string | null;
}

interface SignupSession {
  code: string | null;
  wabaId: string | null;
  phoneNumberId: string | null;
}

interface MetaLoginResponse {
  authResponse?: { code?: string };
}

interface MetaSdk {
  init(options: {
    appId: string;
    autoLogAppEvents: boolean;
    xfbml: boolean;
    version: string;
  }): void;
  login(
    callback: (response: MetaLoginResponse) => void,
    options: {
      config_id: string;
      response_type: 'code';
      override_default_response_type: true;
      extras: Record<string, never>;
    }
  ): void;
}

const META_ID_PATTERN = /^\d+$/;

declare global {
  interface Window {
    FB?: MetaSdk;
    fbAsyncInit?: () => void;
  }
}

export function WhatsAppCoexistence() {
  const t = useTranslations('Settings.coexistence');
  const { canEditSettings } = useAuth();
  const [config, setConfig] = useState<EmbeddedSignupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [httpsUrl, setHttpsUrl] = useState<string | null>(null);
  const [appId, setAppId] = useState('');
  const [configId, setConfigId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [hasMetaAppSecret, setHasMetaAppSecret] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [savingMetaConfig, setSavingMetaConfig] = useState(false);
  const [loadingMetaConfig, setLoadingMetaConfig] = useState(false);
  const signupSession = useRef<SignupSession>({
    code: null,
    wabaId: null,
    phoneNumberId: null,
  });
  const finishingRef = useRef(false);
  const sdkInitializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/whatsapp/coexistence', {
          cache: 'no-store',
        });
        const data = (await response.json()) as EmbeddedSignupConfig & {
          error?: string;
          hasAppSecret?: boolean;
        };
        if (!response.ok) throw new Error(data.error || t('configLoadFailed'));
        if (!cancelled) {
          setConfig(data);
          setAppId(data.appId ?? '');
          setConfigId(data.configId ?? '');
          setAppSecret('');
          setHasMetaAppSecret(Boolean(data.hasAppSecret));
          setConnected(data.connected);
        }
      } catch (caught) {
        console.error(
          'Failed to load WhatsApp coexistence configuration:',
          caught
        );
        if (!cancelled) setError(t('configLoadFailed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const finishSignup = useCallback(async () => {
    const session = signupSession.current;
    if (!session.code || !session.wabaId || finishingRef.current) return;
    finishingRef.current = true;
    setConnecting(true);
    setError('');

    try {
      const response = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signup_code: session.code,
          config_id: config?.configId,
          waba_id: session.wabaId,
          ...(session.phoneNumberId
            ? { phone_number_id: session.phoneNumberId }
            : {}),
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        success?: boolean;
      };
      if (!response.ok || !data.success) {
        throw new Error(data.error || t('connectFailed'));
      }
      setConnected(true);
    } catch (caught) {
      console.error('WhatsApp coexistence signup failed:', caught);
      setError(caught instanceof Error ? caught.message : t('connectFailed'));
    } finally {
      setConnecting(false);
      finishingRef.current = false;
    }
  }, [config, t]);

  const loadMetaConfig = useCallback(async () => {
    try {
      setLoadingMetaConfig(true);
      setError('');
      const response = await fetch('/api/whatsapp/coexistence', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        error?: string;
        appId?: string | null;
        configId?: string | null;
        hasAppSecret?: boolean;
      };
      if (!response.ok) {
        throw new Error(data.error || t('configLoadFailed'));
      }
      setAppId(data.appId ?? '');
      setConfigId(data.configId ?? '');
      setAppSecret('');
      setHasMetaAppSecret(Boolean(data.hasAppSecret));
      setShowSecret(false);
      setConfig((previous) => ({
        ...(previous ?? {
          configured: Boolean(data.appId && data.configId),
          connected: false,
          appId: data.appId ?? null,
          configId: data.configId ?? null,
        }),
        configured: Boolean(data.appId && data.configId),
        appId: data.appId ?? null,
        configId: data.configId ?? null,
      }));
    } catch (caught) {
      console.error(
        'Failed to load Meta embedded-signup configuration:',
        caught
      );
      setError(
        caught instanceof Error ? caught.message : t('configLoadFailed')
      );
    } finally {
      setLoadingMetaConfig(false);
    }
  }, [t]);

  const saveMetaConfig = useCallback(async () => {
    const trimmedAppId = appId.trim();
    const trimmedConfigId = configId.trim();
    const trimmedAppSecret = appSecret.trim();

    if (
      !trimmedAppId ||
      !trimmedConfigId ||
      (!trimmedAppSecret && !hasMetaAppSecret)
    ) {
      setError(t('metaConfigRequired'));
      return;
    }
    if (
      !META_ID_PATTERN.test(trimmedAppId) ||
      !META_ID_PATTERN.test(trimmedConfigId)
    ) {
      setError(t('metaIdsNumeric'));
      return;
    }
    if (trimmedAppId === trimmedConfigId) {
      setError(t('metaConfigIdIsAppId'));
      return;
    }

    try {
      setSavingMetaConfig(true);
      setError('');
      const response = await fetch('/api/whatsapp/coexistence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          meta_app_id: trimmedAppId,
          meta_embedded_signup_config_id: trimmedConfigId,
          meta_embedded_signup_app_secret: trimmedAppSecret,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        appId?: string;
        configId?: string;
        hasAppSecret?: boolean;
      };
      if (!response.ok) {
        throw new Error(data.error || t('metaConfigSaveFailed'));
      }

      if (sdkInitializedRef.current && config?.appId !== trimmedAppId) {
        window.location.reload();
        return;
      }

      setConfig((previous) => ({
        ...(previous ?? {
          configured: true,
          connected: false,
          appId: null,
          configId: null,
        }),
        configured: true,
        appId: data.appId ?? trimmedAppId,
        configId: data.configId ?? trimmedConfigId,
      }));
      setAppId(data.appId ?? trimmedAppId);
      setConfigId(data.configId ?? trimmedConfigId);
      setAppSecret('');
      setHasMetaAppSecret(Boolean(data.hasAppSecret));
      setShowSecret(false);
    } catch (caught) {
      console.error(
        'Failed to save Meta embedded-signup configuration:',
        caught
      );
      setError(
        caught instanceof Error ? caught.message : t('metaConfigSaveFailed')
      );
    } finally {
      setSavingMetaConfig(false);
    }
  }, [appId, appSecret, config, configId, hasMetaAppSecret, t]);

  const initializeSdk = useCallback(() => {
    if (!config?.appId || !window.FB) {
      setSdkFailed(true);
      return;
    }
    if (sdkInitializedRef.current) {
      setSdkReady(true);
      return;
    }
    window.FB.init({
      appId: config.appId,
      autoLogAppEvents: true,
      xfbml: true,
      version: 'v25.0',
    });
    sdkInitializedRef.current = true;
    setSdkReady(true);
  }, [config]);

  useEffect(() => {
    if (!config?.configured || !canEditSettings) return;

    window.fbAsyncInit = initializeSdk;
    const onMessage = (event: MessageEvent<unknown>) => {
      let hostname: string;
      try {
        hostname = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (hostname !== 'facebook.com' && !hostname.endsWith('.facebook.com')) {
        return;
      }

      let message: unknown = event.data;
      if (typeof message === 'string') {
        try {
          message = JSON.parse(message) as unknown;
        } catch {
          return;
        }
      }
      if (!message || typeof message !== 'object') return;
      const signupEvent = message as {
        type?: unknown;
        event?: unknown;
        data?: unknown;
      };
      if (signupEvent.type !== 'WA_EMBEDDED_SIGNUP') return;

      if (signupEvent.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
        const sessionData =
          signupEvent.data && typeof signupEvent.data === 'object'
            ? (signupEvent.data as Record<string, unknown>)
            : {};
        signupSession.current.wabaId =
          typeof sessionData.waba_id === 'string' ? sessionData.waba_id : null;
        signupSession.current.phoneNumberId =
          typeof sessionData.phone_number_id === 'string'
            ? sessionData.phone_number_id
            : null;
        void finishSignup();
      } else if (
        signupEvent.event === 'CANCEL' ||
        signupEvent.event === 'ERROR'
      ) {
        setError(t('flowCancelled'));
      }
    };

    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      if (window.fbAsyncInit === initializeSdk) delete window.fbAsyncInit;
    };
  }, [canEditSettings, config, finishSignup, initializeSdk, t]);

  const launchSignup = () => {
    const { hostname, protocol } = window.location;
    const isLocalhost =
      hostname === 'localhost' ||
      hostname === '::1' ||
      /^127(?:\.\d{1,3}){3}$/.test(hostname);
    if (protocol !== 'https:' && !isLocalhost) {
      const secureUrl = new URL(window.location.href);
      secureUrl.protocol = 'https:';
      setHttpsUrl(secureUrl.toString());
      setError(t('httpsRequired'));
      return;
    }

    const configuredAppId = config?.appId?.trim();
    const configuredConfigId = config?.configId?.trim();
    if (!configuredAppId || !configuredConfigId) {
      setError(t('metaConfigRequired'));
      return;
    }
    if (
      !META_ID_PATTERN.test(configuredAppId) ||
      !META_ID_PATTERN.test(configuredConfigId)
    ) {
      setError(t('metaIdsNumeric'));
      return;
    }
    if (configuredAppId === configuredConfigId) {
      setError(t('metaConfigIdIsAppId'));
      return;
    }

    if (!window.FB || !sdkReady) {
      setError(t('sdkUnavailable'));
      return;
    }
    signupSession.current = { code: null, wabaId: null, phoneNumberId: null };
    finishingRef.current = false;
    setError('');
    setHttpsUrl(null);
    setConnected(false);
    window.FB.login(
      (response) => {
        const code = response.authResponse?.code;
        if (!code) {
          setError(t('flowCancelled'));
          return;
        }
        signupSession.current.code = code;
        void finishSignup();
      },
      {
        config_id: configuredConfigId,
        response_type: 'code',
        override_default_response_type: true,
        extras: {},
      }
    );
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-foreground text-xl font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          {t('description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="text-primary size-4" />
            {t('cardTitle')}
          </CardTitle>
          <CardDescription>{t('cardDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
            <li>{t('step1')}</li>
            <li>{t('step2')}</li>
            <li>{t('step3')}</li>
          </ol>
          <p className="text-muted-foreground text-sm">{t('syncNote')}</p>

          {connected ? (
            <Alert>
              <CheckCircle2 className="size-4" />
              <AlertTitle>{t('connectedTitle')}</AlertTitle>
              <AlertDescription>{t('connectedDescription')}</AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>{t('errorTitle')}</AlertTitle>
              <AlertDescription>
                {error}{' '}
                {httpsUrl ? (
                  <a className="underline" href={httpsUrl}>
                    {t('openHttps')}
                  </a>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          {canEditSettings ? (
            <div className="border-border bg-muted/20 space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  {t('metaSetupInstructions')}
                </p>
                <a
                  href="https://developers.facebook.com/apps/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                >
                  {t('openMetaDevelopers')}
                  <ExternalLink className="size-3" />
                </a>
                <a
                  href="https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business#create-a-configuration"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                >
                  {t('metaConfigGuide')}
                  <ExternalLink className="size-3" />
                </a>
                <a
                  href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation#step-2-create-a-facebook-login-for-business-configuration"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm hover:underline"
                >
                  {t('metaEmbeddedSignupGuide')}
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="meta-app-id">{t('metaAppIdLabel')}</Label>
                <Input
                  id="meta-app-id"
                  value={appId}
                  onChange={(event) => setAppId(event.target.value)}
                  placeholder="123456789012345"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="meta-config-id">{t('metaConfigIdLabel')}</Label>
                <Input
                  id="meta-config-id"
                  value={configId}
                  onChange={(event) => setConfigId(event.target.value)}
                  placeholder="123456789012345"
                />
                <p className="text-muted-foreground text-xs">
                  {t('metaConfigIdHint')}
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="meta-app-secret">
                  {t('metaAppSecretLabel')}
                </Label>
                <div className="relative">
                  <Input
                    id="meta-app-secret"
                    type={showSecret ? 'text' : 'password'}
                    value={appSecret}
                    onChange={(event) => setAppSecret(event.target.value)}
                    placeholder={
                      hasMetaAppSecret
                        ? t('metaAppSecretSavedPlaceholder')
                        : t('metaAppSecretPlaceholder')
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret((current) => !current)}
                    className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2 text-xs underline"
                  >
                    {showSecret ? t('hideSecret') : t('showSecret')}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">
                  {t('metaAppSecretStorage')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={loadMetaConfig}
                  disabled={loadingMetaConfig || !canEditSettings}
                >
                  {loadingMetaConfig ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    t('loadSettings')
                  )}
                </Button>
                <Button
                  type="button"
                  onClick={saveMetaConfig}
                  disabled={savingMetaConfig || !canEditSettings}
                >
                  {savingMetaConfig ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      {t('saving')}
                    </>
                  ) : (
                    t('saveSettings')
                  )}
                </Button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <Button disabled>
              <Loader2 className="size-4 animate-spin" />
              {t('loading')}
            </Button>
          ) : config?.configured ? (
            <>
              <Button
                onClick={launchSignup}
                disabled={
                  !canEditSettings ||
                  !sdkReady ||
                  connecting ||
                  !META_ID_PATTERN.test(config.appId ?? '') ||
                  !META_ID_PATTERN.test(config.configId ?? '')
                }
              >
                {connecting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Smartphone className="size-4" />
                )}
                {connecting
                  ? t('connecting')
                  : connected
                    ? t('reconnectButton')
                    : t('connectButton')}
              </Button>
              {!canEditSettings ? (
                <p className="text-muted-foreground text-sm">
                  {t('adminRequired')}
                </p>
              ) : null}
              {!sdkReady && !connecting && !sdkFailed ? (
                <p className="text-muted-foreground text-sm">
                  {t('loadingSdk')}
                </p>
              ) : null}
              {sdkFailed ? (
                <p className="text-destructive text-sm">
                  {t('sdkUnavailable')}
                </p>
              ) : null}
              {canEditSettings ? (
                <Script
                  src="https://connect.facebook.net/en_US/sdk.js"
                  strategy="afterInteractive"
                  onReady={initializeSdk}
                  onError={() => setSdkFailed(true)}
                />
              ) : null}
            </>
          ) : (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>{t('notConfiguredTitle')}</AlertTitle>
              <AlertDescription>
                {t('notConfiguredDescription')}{' '}
                <a
                  href="https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users"
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  {t('metaDocs')}
                  <ExternalLink className="size-3" />
                </a>
              </AlertDescription>
            </Alert>
          )}
          {!loading && config?.configured ? (
            <p className="text-muted-foreground text-xs">{t('requirements')}</p>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
