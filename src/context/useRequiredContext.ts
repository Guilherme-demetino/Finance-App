import { useContext, type Context } from "react";

/** Lê um contexto que não tem valor padrão, com erro claro se faltar o provider. */
export function useRequiredContext<T>(
  context: Context<T | null>,
  hookName: string,
  providerName: string,
): T {
  const value = useContext(context);
  if (value === null) {
    throw new Error(`${hookName} deve ser usado dentro de ${providerName}`);
  }
  return value;
}
