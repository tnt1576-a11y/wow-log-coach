'use client';
import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

export function CoachDialog({
  label,
  title,
  description,
  children,
}: {
  label: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger className="training-button">{label}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="training-backdrop" />
        <Dialog.Popup className="training-dialog">
          <div className="training-dialog-head">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close
              className="training-icon-button"
              aria-label="Close details"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="training-muted">
            {description}
          </Dialog.Description>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
