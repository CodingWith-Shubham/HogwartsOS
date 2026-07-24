import type { Lead } from '@/lib/sheets/types';

export const PAYMENT_STATUS = {
  LINK_SENT: 'Link Sent',
  LINK_SENT_LEGACY: 'Payment Link Sent',
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING_VERIFICATION_LEGACY: 'Screenshot Uploaded - Pending Verification',
  VERIFIED: 'Payment Verified',
  CONFIRMED: 'Payment Confirmed',
  CONFIRMED_ALT: 'Confirmed',
} as const;

const LINK_SENT_STATUSES: string[] = [
  PAYMENT_STATUS.LINK_SENT,
  PAYMENT_STATUS.LINK_SENT_LEGACY,
];

const PENDING_VERIFICATION_STATUSES: string[] = [
  PAYMENT_STATUS.PENDING_VERIFICATION,
  PAYMENT_STATUS.PENDING_VERIFICATION_LEGACY,
];

const VERIFIED_STATUSES: string[] = [
  PAYMENT_STATUS.VERIFIED,
  PAYMENT_STATUS.CONFIRMED,
  PAYMENT_STATUS.CONFIRMED_ALT,
];

export function getPaymentStatus(lead: Lead): string {
  return (lead.payment_status ?? lead.payment?.paymentStatus ?? '').trim();
}

export function getScreenshotUrl(lead: Lead): string {
  return lead.payment?.screenshotUrl?.trim() ?? '';
}

export function isPaymentLinkSent(lead: Lead): boolean {
  if (!lead.payment && !lead.payment_status) return false;

  const linkSent = lead.payment?.paymentLinkSent.trim().toLowerCase() === 'true';
  const status = getPaymentStatus(lead);

  return (
    linkSent ||
    LINK_SENT_STATUSES.includes(status) ||
    PENDING_VERIFICATION_STATUSES.includes(status) ||
    VERIFIED_STATUSES.includes(status)
  );
}

export function canSendPaymentLink(lead: Lead): boolean {
  return lead.proposalAccepted && !isPaymentLinkSent(lead);
}

export function isPendingPaymentVerification(lead: Lead): boolean {
  return PENDING_VERIFICATION_STATUSES.includes(getPaymentStatus(lead));
}

export function isPaymentVerified(lead: Lead): boolean {
  return VERIFIED_STATUSES.includes(getPaymentStatus(lead));
}

/** @deprecated use isPaymentVerified */
export function isPaymentConfirmed(lead: Lead): boolean {
  return isPaymentVerified(lead);
}

export function filterSalesLeads<T extends Lead>(
  leads: T[],
  userName: string | undefined,
  userRole: string | undefined
): T[] {
  return leads.filter(
    (lead) =>
      lead.assignedTo === userName ||
      userRole === 'manager' ||
      userRole === 'sales' ||
      userRole === 'admin'
  );
}

export function countPendingVerifications(
  leads: Lead[],
  userName: string | undefined,
  userRole: string | undefined
): number {
  return filterSalesLeads(leads, userName, userRole).filter(isPendingPaymentVerification)
    .length;
}
