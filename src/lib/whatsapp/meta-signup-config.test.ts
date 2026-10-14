import { describe, expect, it } from 'vitest';

import { encrypt } from '@/lib/whatsapp/encryption';
import { resolveMetaSignupSettings } from '@/lib/whatsapp/meta-signup-config';

describe('resolveMetaSignupSettings', () => {
  it('decrypts an App Secret stored as ciphertext', () => {
    expect(
      resolveMetaSignupSettings({
        meta_app_id: '123',
        meta_embedded_signup_config_id: '456',
        meta_embedded_signup_app_secret: encrypt('private-secret'),
      })
    ).toEqual({
      appId: '123',
      configId: '456',
      appSecret: 'private-secret',
      configured: true,
    });
  });

  it('continues to read a legacy plaintext App Secret', () => {
    expect(
      resolveMetaSignupSettings({
        meta_app_id: '123',
        meta_embedded_signup_config_id: '456',
        meta_embedded_signup_app_secret: 'legacy-secret',
      }).appSecret
    ).toBe('legacy-secret');
  });
});
