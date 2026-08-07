import React, { useState, useEffect, useCallback } from 'react';
import { MessageBar, MessageBarBody, MessageBarActions, Button } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';

type ToastType = 'success' | 'error' | 'info';
type ToastOpts = { intent?: ToastType; duration?: number };

interface ToastMsg {
  message: string;
  type: ToastType;
  key: number;
  durationMs?: number;
}

let showToastGlobal: (msg: string, type?: ToastType, durationMs?: number) => void = () => {};

export function useToast() {
  // Accepts either a positional ToastType string — toast(msg, 'error') — or a
  // Fluent-style options object — toast(msg, { intent: 'error', duration: 0 }).
  // Most call sites use the object form; without this normalization the object
  // was treated as the `type`, never matched 'error', and every error toast
  // rendered green (success) and ignored `duration: 0` persistence.
  return useCallback((msg: string, opts?: ToastType | ToastOpts, durationMs?: number) => {
    let type: ToastType = 'success';
    let dur = durationMs;
    if (typeof opts === 'string') {
      type = opts;
    } else if (opts) {
      if (opts.intent) type = opts.intent;
      if (opts.duration !== undefined) dur = opts.duration;
    }
    showToastGlobal(msg, type, dur);
  }, []);
}

export function ToastContainer() {
  const [queue, setQueue] = useState<ToastMsg[]>([]);
  const visible = queue[0] ?? null;

  useEffect(() => {
    showToastGlobal = (msg, type = 'success', durationMs) => {
      setQueue(q => {
        const stripped = q.filter(t => t.durationMs !== 0);
        return [...stripped, { message: msg, type, key: Date.now(), durationMs }];
      });
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (visible.durationMs === 0) return;
    const t = setTimeout(() => setQueue(q => q.slice(1)), visible.durationMs ?? 3000);
    return () => clearTimeout(t);
  }, [visible]);

  const dismiss = () => setQueue(q => q.slice(1));

  if (!visible) return null;

  const intent = visible.type === 'error' ? 'error' : visible.type === 'info' ? 'info' : 'success';
  const isPersistent = visible.durationMs === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: 'fixed',
        top: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999,
        minWidth: isPersistent ? 560 : 280,
        maxWidth: isPersistent ? 'min(95vw, 1200px)' : 'min(90vw, 600px)',
      }}
    >
      <MessageBar intent={intent}>
        <MessageBarBody>{visible.message}</MessageBarBody>
        {isPersistent && (
          <MessageBarActions
            containerAction={
              <Button
                aria-label="Dismiss"
                appearance="transparent"
                icon={<DismissRegular />}
                onClick={dismiss}
              />
            }
          />
        )}
      </MessageBar>
    </div>
  );
}
