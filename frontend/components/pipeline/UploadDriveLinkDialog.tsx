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
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { UPLOAD_DRIVE_LINK_URL } from './stageDialogShared';

/** Shoot target for the drive-link upload (same identity the Shoot dashboard uses). */
export interface DriveLinkTarget {
  shootId: string;
  clientName: string;
}

export interface UploadDriveLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DriveLinkTarget | null;
  /** Extra fields appended to the webhook payload (e.g. `{ upsell_crosssell_id }`). */
  extraPayload?: Record<string, string>;
  /** Called after the webhook succeeds — receives the uploaded link. */
  onSuccess?: (dataLink: string) => void | Promise<void>;
}

/**
 * Same drive-link upload flow as the Shoot dashboard (`uploadDriveLink`):
 * POSTs `{ shoot_id, data_link }` to the upload-drive-link n8n webhook.
 */
export function UploadDriveLinkDialog({
  open,
  onOpenChange,
  target,
  extraPayload,
  onSuccess,
}: UploadDriveLinkDialogProps) {
  const [dataLink, setDataLink] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) setDataLink('');
  }, [open]);

  const handleUpload = async () => {
    const trimmed = dataLink.trim();
    if (!target || !trimmed) {
      toast.error('Please provide a drive link');
      return;
    }

    setUploading(true);
    try {
      const response = await fetch(UPLOAD_DRIVE_LINK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shoot_id: target.shootId,
          data_link: trimmed,
          ...(extraPayload ?? {}),
        }),
      });

      if (!response.ok) throw new Error('Failed to upload drive link');

      toast.success('Footage uploaded!');
      onOpenChange(false);
      await onSuccess?.(trimmed);
    } catch (error) {
      toast.error('Failed to upload drive link', {
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Drive Link</DialogTitle>
          <DialogDescription>
            {target ? `Upload the footage folder link for ${target.clientName}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor="upsell-drive-link-input">Drive Link</Label>
          <Input
            id="upsell-drive-link-input"
            value={dataLink}
            onChange={(e) => setDataLink(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={uploading || !dataLink.trim()}>
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload Footage
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
