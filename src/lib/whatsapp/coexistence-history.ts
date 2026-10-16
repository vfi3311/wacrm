import { normalizePhone } from './phone-utils'

export type CoexistenceSenderType = 'customer' | 'agent'
export type CoexistenceMessageStatus = 'sent' | 'delivered' | 'read' | 'failed'

export interface CoexistenceMessageDirection {
  senderType: CoexistenceSenderType
  contactPhone: string
}

export interface CoexistenceMessageIdentity {
  from?: string
  to?: string
}

/**
 * The thread id is the customer phone number. For history messages, Meta
 * identifies outbound messages by the business phone in `from` and may add
 * `to` for SMB echoes; ordinary inbound messages come from the customer.
 */
export function resolveCoexistenceMessageDirection(
  message: CoexistenceMessageIdentity,
  threadId: string | undefined,
  businessPhone: string
): CoexistenceMessageDirection | null {
  const from = normalizePhone(message.from ?? '')
  const to = normalizePhone(message.to ?? '')
  const threadPhone = normalizePhone(threadId ?? '')
  const business = normalizePhone(businessPhone)
  const outbound = !!business && from === business
  const contactPhone = outbound ? to || threadPhone : from || threadPhone

  if (!contactPhone) return null
  return {
    senderType: outbound ? 'agent' : 'customer',
    contactPhone,
  }
}

export function normalizeCoexistenceMessageStatus(
  status: string | undefined
): CoexistenceMessageStatus {
  switch (status?.toUpperCase()) {
    case 'DELIVERED':
      return 'delivered'
    case 'READ':
    case 'PLAYED':
      return 'read'
    case 'ERROR':
      return 'failed'
    case 'PENDING':
    case 'SENT':
    default:
      return 'sent'
  }
}