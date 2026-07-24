import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import type { Lead } from '@/lib/sheets/types';
import {
  getPaymentStatus,
  getScreenshotUrl,
  isPaymentVerified,
  isPendingPaymentVerification,
  PAYMENT_STATUS,
} from '@/lib/sheets/payment-utils';
import { cn } from '@/lib/utils';

interface PaymentStatusIndicatorProps {
  lead: Lead;
  className?: string;
}

export function PaymentStatusIndicator({ lead, className }: PaymentStatusIndicatorProps) {
  const status = getPaymentStatus(lead);
  if (!status) return null;

  if (isPaymentVerified(lead)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/15 px-2 py-0.5 text-[11px] font-medium text-green-600',
          className
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Payment Verified
      </span>
    );
  }

  if (isPendingPaymentVerification(lead)) {
    const screenshotUrl = getScreenshotUrl(lead);

    if (screenshotUrl) {
      return (
        <a
          href={screenshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 hover:bg-amber-500/25 transition-colors',
            className
          )}
        >
          <AlertCircle className="h-3 w-3" />
          Screenshot uploaded - View
          <ExternalLink className="h-3 w-3 opacity-70" />
        </a>
      );
    }

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600',
          className
        )}
      >
        <AlertCircle className="h-3 w-3" />
        Screenshot uploaded — pending verification
      </span>
    );
  }

  if (
    status === PAYMENT_STATUS.LINK_SENT ||
    status === PAYMENT_STATUS.LINK_SENT_LEGACY
  ) {
    return (
      <p className={cn('text-[11px] font-medium text-blue-500', className)}>
        Link Sent
      </p>
    );
  }

  return null;
}
