import { useMemo } from "react";
import { useSearchParams } from "react-router";

export const useQueryParam = (key: string, fallback: string) => {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;

  const setValue = (nextValue: string) => {
    const next = new URLSearchParams(params);
    if (!nextValue || nextValue === fallback) {
      next.delete(key);
    } else {
      next.set(key, nextValue);
    }
    setParams(next, { replace: true });
  };

  return useMemo(() => [value, setValue] as const, [value]);
};