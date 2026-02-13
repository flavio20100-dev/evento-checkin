// Simple toast hook implementation
import { useState, useCallback } from 'react';

interface Toast {
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Array<Toast & { id: number }>>([]);

  const toast = useCallback(({ title, description, variant = 'default' }: Toast) => {
    const id = toastId++;

    // Show browser notification or console log for MVP
    if (variant === 'destructive') {
      alert(`❌ ${title}\n${description || ''}`);
    } else {
      // Simple notification for success
      console.log(`✓ ${title}`, description);

      // For a better UX, you could use a toast library like react-hot-toast
      // For MVP, we'll use a simple alert for errors and console for success
    }

    setToasts((prev) => [...prev, { id, title, description, variant }]);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  return { toast, toasts };
}
