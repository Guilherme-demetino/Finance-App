import { useCallback, useEffect, useRef } from "react";

/**
 * Devolve uma função com identidade fixa que sempre chama a versão mais
 * recente de `fn`. Serve para expor uma ação num contexto sem que o valor do
 * contexto mude (e re-renderize quem o consome) toda vez que o provider
 * renderiza de novo com uma função nova.
 */
export function useStableCallback<Args extends unknown[], Result>(
  fn: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(fn);

  useEffect(() => {
    latest.current = fn;
  });

  return useCallback((...args: Args) => latest.current(...args), []);
}
