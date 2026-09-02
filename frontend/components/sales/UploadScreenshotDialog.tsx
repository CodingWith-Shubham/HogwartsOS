import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '@/lib/auth-fetch';
import type { PaymentInstallment } from '@/lib/types';

interface UploadScreenshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: PaymentInstallment | null;
  onSuccess: () => void;
}

export function UploadScreenshotDialog({ open, onOpenChange, payment, onSuccess }: UploadScreenshotDialogProps) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    if (!file) {
      toast.error('Please select a file to upload');
      return;
    }

    setLoading(true);
    try {
      // 1. Upload file to our backend
      const formData = new FormData();
      formData.append('attachment', file);
      
      const uploadRes = await authFetch('/api/client-profiles/upload-attachment', {
        method: 'POST',
        body: formData,
      });
      
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        throw new Error(uploadData.error || 'Failed to upload screenshot');
      }

      const screenshotUrl = uploadData.url || uploadData.data?.url;

      // 2. Call the verify payment endpoint with the screenshot URL
      const targetPaymentId = (payment as any).payment_id || (payment as any).paymentId;
      const verifyRes = await authFetch(`/api/payments/${targetPaymentId}/verify`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotUrl,
          utrNumber: utrNumber.trim() || 'Not provided',
          paymentStatus: 'Screenshot Received',
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Failed to update payment status');
      }

      toast.success('Screenshot uploaded successfully!');
      onSuccess();
      onOpenChange(false);
      setFile(null);
      setUtrNumber('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      toast.error('Upload failed', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Upload Payment Screenshot</DialogTitle>
          <DialogDescription>
            Upload a payment screenshot for {(payment as any)?.client_name || 'this client'} {(payment as any)?.installment_label ? `(${(payment as any).installment_label})` : ''}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleUpload} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="screenshot">Screenshot Image</Label>
            <Input
              id="screenshot"
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={loading}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="utrNumber">UTR Number (Optional)</Label>
            <Input
              id="utrNumber"
              type="text"
              placeholder="e.g. 123456789012"
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              disabled={loading}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
