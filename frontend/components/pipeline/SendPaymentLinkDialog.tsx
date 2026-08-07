'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import { useAuth } from '@/lib/auth-context';
import { formatINR } from '@/lib/formatter';
import type { InstallmentLabel, PaymentMode } from '@/lib/types';
import { parseCost } from './stageDialogShared';

const INSTALLMENT_LABELS: InstallmentLabel[] = ['Advance', 'Day Before Shoot', 'Post Shoot', 'Custom'];

/** Minimal lead shape the payment modal needs. */
export interface PaymentDialogLead {
  leadId: string;
  name: string;
  clientEmail: string;
  cost: string;
  assignedTo: string;
}

/** Payment math the dialog operates on (verified total + remaining balance). */
export interface PaymentDialogSummary {
  totalCollected: number;
  remaining: number;
}

export interface SendPaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: PaymentDialogLead | null;
  summary: PaymentDialogSummary | null;
  /** Extra form fields forwarded to the webhook (e.g. `{ upsell_crosssell_id }`). */
  extraPayload?: Record<string, string>;
  /** Called after the webhook succeeds — e.g. advance pipeline status. */
  onSuccess?: () => void | Promise<void>;
}

export function SendPaymentLinkDialog({
  open,
  onOpenChange,
  lead,
  summary,
  extraPayload,
  onSuccess,
}: SendPaymentLinkDialogProps) {
  const { user } = useAuth();
  const [paymentOption, setPaymentOption] = useState<'50' | '100' | 'custom'>('50');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Online');
  const [installmentLabel, setInstallmentLabel] = useState<InstallmentLabel>('Advance');
  const [cashCollectedBy, setCashCollectedBy] = useState('');
  const [additionalEmails, setAdditionalEmails] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaymentOption('50');
    setCustomAmount('');
    setPaymentMode('Online');
    setInstallmentLabel('Advance');
    setCashCollectedBy(user?.name ?? '');
    setAdditionalEmails('');
    setInvoiceFile(null);
    // Reset to defaults each time the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleClose = () => {
    onOpenChange(false);
    setAdditionalEmails('');
    setInvoiceFile(null);
  };

  const handleSendPaymentLink = async () => {
    if (!lead || !user || !summary) return;

    const totalCost = parseCost(lead.cost);
    const { remaining: remainingBeforePayment, totalCollected } = summary;
    const amountToCollect = paymentOption === 'custom'
      ? Number(customAmount)
      : (remainingBeforePayment * Number(paymentOption)) / 100;
    const percentage = (amountToCollect / totalCost) * 100;

    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      toast.error('A valid project cost is required before sending a payment link');
      return;
    }

    if (!Number.isFinite(amountToCollect) || amountToCollect <= 0 || amountToCollect > remainingBeforePayment) {
      toast.error('Payment amount must be greater than zero and cannot exceed the remaining balance');
      return;
    }

    if (paymentMode === 'Cash' && !cashCollectedBy.trim()) {
      toast.error('Cash collector name is required');
      return;
    }

    if (!invoiceFile) {
      toast.error('An invoice or supporting document is required before sending a payment link');
      return;
    }

    const roundedAmountToCollect = Number(amountToCollect.toFixed(2));
    const roundedPercentage = Number(percentage.toFixed(2));
    const remainingAmount = Number((remainingBeforePayment - roundedAmountToCollect).toFixed(2));

    setSendingPaymentLink(true);
    try {
      const formData = new FormData();
      formData.append('lead_id', lead.leadId);
      formData.append('client_name', lead.name);
      formData.append('client_email', lead.clientEmail);
      formData.append('cost', lead.cost);
      formData.append('total_cost', String(totalCost));
      formData.append('amount_to_collect', String(roundedAmountToCollect));
      formData.append('remaining_amount', String(remainingAmount));
      formData.append('amount_paid_so_far', String(totalCollected));
      formData.append('payment_percentage', String(roundedPercentage));
      formData.append('payment_type', roundedPercentage === 100 ? 'Full Payment' : 'Advance Payment');
      formData.append('payment_mode', paymentMode);
      formData.append('cash_collected_by', paymentMode === 'Cash' ? cashCollectedBy.trim() : '');
      formData.append('installment_label', installmentLabel);
      formData.append('salesperson_name', lead.assignedTo);
      formData.append('salesperson_email', user.email);
      formData.append('additional_emails', additionalEmails);
      if (invoiceFile) {
        formData.append('invoice_file', invoiceFile);
      }
      for (const [key, value] of Object.entries(extraPayload ?? {})) {
        formData.append(key, value);
      }

      const response = await authFetch('/api/send-payment-link', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to send payment link');
      }

      onOpenChange(false);
      setAdditionalEmails('');
      setInvoiceFile(null);
      toast.success(paymentMode === 'Cash' ? 'Cash payment recorded!' : 'Payment link sent!');
      await onSuccess?.();
    } catch (error) {
      toast.error('Failed to send payment link', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setSendingPaymentLink(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Payment Link</DialogTitle>
          <DialogDescription>
            Send payment instructions to {lead?.clientEmail || 'the client'}?
          </DialogDescription>
        </DialogHeader>
        {lead && summary && (
          <>
          <div className="rounded-md border border-border p-3 space-y-1 text-sm">
            <p className="font-medium">{lead.name}</p>
            <p className="text-muted-foreground">{lead.clientEmail}</p>
            <p className="text-muted-foreground tabular-nums">
              Amount: {lead.cost ? formatINR(parseCost(lead.cost)) : '—'}
            </p>
          </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Payment Mode</legend>
              <div className="grid grid-cols-2 rounded-md border border-border p-1">
                {(['Online', 'Cash'] as PaymentMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={paymentMode === mode ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setPaymentMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="installment-label">Installment Label</Label>
              <Select value={installmentLabel} onValueChange={(value) => setInstallmentLabel(value as InstallmentLabel)}>
                <SelectTrigger id="installment-label"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INSTALLMENT_LABELS.map((label) => <SelectItem key={label} value={label}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {paymentMode === 'Cash' ? (
              <>
              <div className="space-y-2">
                <Label htmlFor="cash-collected-by">Cash collected by</Label>
                <Input
                  id="cash-collected-by"
                  required
                  value={cashCollectedBy}
                  onChange={(e) => setCashCollectedBy(e.target.value)}
                  placeholder="Collector's name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cash-invoice-file">Attach Invoice/Document *</Label>
                <Input
                  id="cash-invoice-file"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required
                  onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
                />
              </div>
              </>
            ) : (
              <>
            <div className="space-y-2">
              <Label htmlFor="additional-emails">Additional Emails (Comma separated)</Label>
              <Input
                id="additional-emails"
                type="text"
                value={additionalEmails}
                onChange={(e) => setAdditionalEmails(e.target.value)}
                placeholder="person@example.com, finance@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice-file">Attach Invoice/Document *</Label>
              <Input
                id="invoice-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                required
                onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)}
              />
            </div>
              </>
            )}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Advance Payment Type</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {[
                  { value: '50', label: '50% Advance' },
                  { value: '100', label: '100% Full Payment' },
                  { value: 'custom', label: 'Custom amount' },
                ].map((option) => (
                  <Label key={option.value} className="flex cursor-pointer items-center gap-2 font-normal">
                    <input
                      type="radio"
                      name="payment-option"
                      value={option.value}
                      checked={paymentOption === option.value}
                      onChange={() => setPaymentOption(option.value as '50' | '100' | 'custom')}
                    />
                    {option.label}
                  </Label>
                ))}
              </div>
              {paymentOption === 'custom' && (
                <div className="max-w-56 space-y-2">
                  <Label htmlFor="custom-payment-amount">Custom amount (₹)</Label>
                  <Input
                    id="custom-payment-amount"
                    type="number"
                    min="0.01"
                    max={summary.remaining}
                    step="0.01"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="e.g. 25000"
                  />
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {Number(customAmount) > 0 && parseCost(lead.cost) > 0
                      ? `This is ${((Number(customAmount) / parseCost(lead.cost)) * 100).toFixed(2)}% of the total amount.`
                      : 'Enter an amount to see its percentage of the total.'}
                  </p>
                </div>
              )}
            </fieldset>
            <div className="rounded-md bg-muted p-3 text-sm space-y-1 tabular-nums">
              <p>
                Amount to collect: {formatINR(paymentOption === 'custom' ? Number(customAmount) || 0 : (summary.remaining * Number(paymentOption)) / 100)}
              </p>
              <p className="text-muted-foreground">
                Remaining balance after this payment: {formatINR(summary.remaining - (paymentOption === 'custom' ? Number(customAmount) || 0 : (summary.remaining * Number(paymentOption)) / 100))}
              </p>
            </div>
          </>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button onClick={handleSendPaymentLink} disabled={sendingPaymentLink || !invoiceFile}>
            <Wallet className="mr-1.5 h-4 w-4" />
            {paymentMode === 'Cash' ? 'Record Cash Payment' : 'Send Payment Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

