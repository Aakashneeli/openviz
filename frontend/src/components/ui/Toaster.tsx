// ============================================
// Toaster - Toast notification container
// ============================================

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      offset={24}
      gap={12}
      visibleToasts={5}
      expand={false}
      richColors
      closeButton
      toastOptions={{
        style: {
          background: 'hsl(240 10% 3.9%)',
          border: '1px solid hsl(240 3.7% 15.9%)',
          color: 'hsl(0 0% 98%)',
        },
        classNames: {
          toast: 'group font-sans',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground text-xs px-2 py-1 rounded',
          cancelButton: 'bg-muted text-muted-foreground text-xs px-2 py-1 rounded',
          closeButton: 'bg-background border-border hover:bg-muted',
          success: 'border-green-500/30 [&_[data-icon]]:text-green-400',
          error: 'border-red-500/30 [&_[data-icon]]:text-red-400',
          info: 'border-blue-500/30 [&_[data-icon]]:text-blue-400',
          warning: 'border-yellow-500/30 [&_[data-icon]]:text-yellow-400',
          loading: 'border-indigo-500/30 [&_[data-icon]]:text-indigo-400',
        },
      }}
    />
  );
}
