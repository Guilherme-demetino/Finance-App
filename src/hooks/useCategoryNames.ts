import { useEffect, useState } from "react";

import { getAllCategories } from "../database/categories";
import { logError } from "../utils/logger";

/**
 * Nomes das categorias cadastradas (de receita e de despesa), para o filtro de categorias.
 * `reloadSignal` muda quando algo mudou (ex.: uma categoria nova foi criada ao salvar uma transação).
 */
export function useCategoryNames(reloadSignal: unknown): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getAllCategories()
      .then((rows) => {
        if (!cancelled) setNames(rows.map((row) => row.name).filter((name) => name.trim() !== ""));
      })
      .catch((error) => logError("Erro ao buscar as categorias para o filtro:", error));
    return () => {
      cancelled = true;
    };
  }, [reloadSignal]);

  return names;
}
