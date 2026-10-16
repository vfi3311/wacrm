import { describe, expect, it } from 'vitest'

import {
  normalizeCoexistenceMessageStatus,
  resolveCoexistenceMessageDirection,
} from './coexistence-history'

describe('WhatsApp Business app history messages', () => {
  it('identifies a business app message as outbound and uses its recipient', () => {
    expect(
      resolveCoexistenceMessageDirection(
        { from: '+1 (555) 078-3881', to: '16505551234' },
        undefined,
        '15550783881'
      )
    ).toEqual({ senderType: 'agent', contactPhone: '16505551234' })
  })

  it('uses the thread id when an outbound historical message omits its recipient', () => {
    expect(
      resolveCoexistenceMessageDirection(
        { from: '15550783881' },
        '16505551234',
        '15550783881'
      )
    ).toEqual({ senderType: 'agent', contactPhone: '16505551234' })
  })

  it('identifies a customer message from the thread phone', () => {
    expect(
      resolveCoexistenceMessageDirection(
        { from: '16505551234' },
        '16505551234',
        '15550783881'
      )
    ).toEqual({ senderType: 'customer', contactPhone: '16505551234' })
  })

  it('ignores malformed entries without a customer identity', () => {
    expect(
      resolveCoexistenceMessageDirection({}, undefined, '15550783881')
    ).toBeNull()
  })

  it.each([
    ['DELIVERED', 'delivered'],
    ['READ', 'read'],
    ['PLAYED', 'read'],
    ['ERROR', 'failed'],
    ['PENDING', 'sent'],
    ['SENT', 'sent'],
  ] as const)('maps history status %s to %s', (input, output) => {
    expect(normalizeCoexistenceMessageStatus(input)).toBe(output)
  })
})