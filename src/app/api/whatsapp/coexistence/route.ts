import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api');

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
      .select('account_id')
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
      .select('status')
      .eq('account_id', profile.account_id)
      .maybeSingle();
    if (configError) {
      console.error(
        '[whatsapp/coexistence] Failed to load WhatsApp status:',
        configError
      );
      return NextResponse.json(
        { error: t('common.internalServerError') },
        { status: 500 }
      );
    }

    const appId = process.env.META_APP_ID ?? '';
    const configId = process.env.META_EMBEDDED_SIGNUP_CONFIG_ID ?? '';

    return NextResponse.json({
      configured: Boolean(
        appId && configId && process.env.META_EMBEDDED_SIGNUP_APP_SECRET
      ),
      connected: whatsappConfig?.status === 'connected',
      appId: appId || null,
      configId: configId || null,
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
