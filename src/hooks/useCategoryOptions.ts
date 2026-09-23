import { useEffect, useState } from "react";

import { getAllCategories } from "../database/categories";
import type { CategoryRow } from "../types";
import { logError } from "../utils/logger";

/** Categorias cadastradas, recarregadas toda vez que `visible` fica true (usado pelo formulário de transação). */
export function useCategoryOptions(visible: boolean) {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Ao abrir, marca "carregando" já na renderização (sem setState síncrono no effect).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setIsLoading(true);
  }

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    getAllCategories()
      .then((result) => {
        if (!cancelled) setCategories(result);
      })
      .catch((error) => logError("Erro ao buscar categorias:", error))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const refresh = async () => {
    setIsLoading(true);
    try {
      setCategories(await getAllCategories());
    } catch (error) {
      logError("Erro ao buscar categorias:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { categories, isLoading, refresh };
}
