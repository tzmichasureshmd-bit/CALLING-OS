import { useEffect, useState, useCallback } from "react";

// Generic data-loading hook: handles loading / error / data + retry.
// Usage: const { loading, error, data, reload } = useResource(() => dataSource.getCalls());
export function useResource(fetcher, deps = []) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.resolve(fetcher())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, error, data, reload };
}
