'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast = { ...toast, id };

    setToasts(prev => [...prev, newToast]);

    // Auto remove after duration
    if (toast.duration !== 0) {
      setTimeout(() => {
        removeToast(id);
      }, toast.duration || 5000);
    }
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm animate-in slide-in-from-right-full',
        {
          'bg-green-50 border-green-200 text-green-800': toast.type === 'success',
          'bg-red-50 border-red-200 text-red-800': toast.type === 'error',
          'bg-yellow-50 border-yellow-200 text-yellow-800': toast.type === 'warning',
          'bg-blue-50 border-blue-200 text-blue-800': toast.type === 'info',
        }
      )}
    >
      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{toast.title}</div>
        {toast.message && (
          <div className="text-sm mt-1 opacity-90">{toast.message}</div>
        )}
      </div>
      <button
        onClick={onClose}
        className="flex-shrink-0 p-1 hover:bg-black/10 rounded"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
