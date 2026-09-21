type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Avisa o resto do app que cartões, compras ou pagamentos de fatura mudaram. A tela de cartões
 * fica fora do painel; quem lê faturas e transações lá dentro assina aqui para se atualizar
 * (pagar uma fatura cria uma despesa no saldo, e os avisos do Início dependem das faturas).
 */
export function notifyCardsChanged(): void {
  for (const listener of [...listeners]) listener();
}

/** Assina as mudanças; devolve a função que cancela a assinatura. */
export function subscribeToCardChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
