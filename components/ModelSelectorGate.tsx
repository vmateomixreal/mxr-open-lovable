'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Static access so Next inlines the value into the client bundle.
 * Dynamic process.env[name] is undefined on the client and incorrectly defaults to "on".
 */
function isModelSelectorEnabled(): boolean {
  const raw = process.env.NEXT_PUBLIC_ENABLE_MODEL_SELECTOR;
  if (raw == null || raw === '') return true;
  return !['0', 'false', 'no', 'off'].includes(String(raw).trim().toLowerCase());
}

/**
 * Renders children only when the model selector is enabled.
 * Defers until after mount so SSR and the first client paint match.
 */
export function ModelSelectorGate({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  if (!ready) {
    return <>{fallback}</>;
  }

  if (!isModelSelectorEnabled()) {
    return null;
  }

  return <>{children}</>;
}
