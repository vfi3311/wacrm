import { NextResponse } from 'next/server';

import { canEditSettings, isAccountRole } from '@/lib/auth/roles';
import { startCoexistenceHistorySync } from '@/lib/whatsapp/start-history-sync';
import { createClient } from '@/lib/supabase/server';
import { getT } from '@/lib/i18n/translate';

const t = getT('Api');

export async function POST() {
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
      console.error('[history-sync] Failed to resolve account:', profileError);
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

    const sync = await startCoexistenceHistorySync(
      supabase,
      profile.account_id
    );

    return NextResponse.json(
      { historySync: sync },
      { status: sync.state === 'failed' ? 502 : 200 }
    );
  } catch (error) {
    console.error('[history-sync] Could not start history synchronization:', error);
    return NextResponse.json(
      { error: t('common.internalServerError') },
      { status: 500 }
    );
  }
}
