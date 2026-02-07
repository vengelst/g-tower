import { useState, useCallback } from 'react';

export function useApiAction() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T>(apiCall: () => Promise<T>) => {
    setIsLoading(true); setError(null);
    try { const r = await apiCall(); setIsLoading(false); return r; }
    catch (err) { setError(err instanceof Error ? err.message : 'Fehler'); setIsLoading(false); throw err; }
  }, []);

  return { isLoading, error, execute };
}
