'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:shadow-lg group-[.toaster]:rounded-lg group-[.toaster]:border group-[.toaster]:px-4 group-[.toaster]:py-3',
          description: 'group-[.toast]:text-sm group-[.toast]:opacity-90',
          actionButton:
            'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          // Colored toast styles — react-toastify inspired
          error:
            'group-[.toaster]:!bg-red-50 group-[.toaster]:!border-red-400 group-[.toaster]:!text-red-800 dark:group-[.toaster]:!bg-red-950 dark:group-[.toaster]:!border-red-700 dark:group-[.toaster]:!text-red-200',
          success:
            'group-[.toaster]:!bg-emerald-50 group-[.toaster]:!border-emerald-400 group-[.toaster]:!text-emerald-800 dark:group-[.toaster]:!bg-emerald-950 dark:group-[.toaster]:!border-emerald-700 dark:group-[.toaster]:!text-emerald-200',
          info:
            'group-[.toaster]:!bg-blue-50 group-[.toaster]:!border-blue-400 group-[.toaster]:!text-blue-800 dark:group-[.toaster]:!bg-blue-950 dark:group-[.toaster]:!border-blue-700 dark:group-[.toaster]:!text-blue-200',
          warning:
            'group-[.toaster]:!bg-amber-50 group-[.toaster]:!border-amber-400 group-[.toaster]:!text-amber-800 dark:group-[.toaster]:!bg-amber-950 dark:group-[.toaster]:!border-amber-700 dark:group-[.toaster]:!text-amber-200',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
