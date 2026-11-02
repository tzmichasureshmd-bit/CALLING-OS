import { useEffect, useState, useCallback, useRef } from "react";

export function useResource(fetcher, deps = []) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const fetcherRef = useRef(fetcher);
  const dataRef = useRef(null);
  const requestSequence = useRef(0);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const initial = dataRef.current === null;
    if (initial) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const result = await fetcherRef.current();
      if (sequence !== requestSequence.current) return null;
      dataRef.current = result;
      setData(result);
      return result;
    } catch (err) {
      if (sequence !== requestSequence.current) return null;
      setError(err);
      return null;
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    reload();
    return () => { requestSequence.current += 1; };
  }, [reload]);

  return { loading, refreshing, error, data, reload };
}
