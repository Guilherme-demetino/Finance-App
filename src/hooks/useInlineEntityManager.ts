import { useState } from "react";

interface UseInlineEntityManagerParams<TDeletable> {
  selectedValue: string;
  setSelectedValue: (value: string) => void;
  fallbackValue: string;
  valueOf: (item: TDeletable) => string;
  remove: (item: TDeletable) => Promise<void>;
}

/**
 * Estado comum ao "criar/excluir sem sair do formulário" usado hoje por categoria e por conta dentro de
 * TransactionModal: um modal de criação e uma confirmação de exclusão que, se o item excluído era o
 * selecionado no momento, volta o formulário para um valor padrão.
 */
export function useInlineEntityManager<TDeletable>({
  selectedValue,
  setSelectedValue,
  fallbackValue,
  valueOf,
  remove,
}: UseInlineEntityManagerParams<TDeletable>) {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<TDeletable | null>(null);

  const confirmDelete = async () => {
    const item = itemToDelete;
    setItemToDelete(null);
    if (!item) return;

    await remove(item);
    if (selectedValue === valueOf(item)) setSelectedValue(fallbackValue);
  };

  return {
    isCreateModalVisible,
    openCreateModal: () => setIsCreateModalVisible(true),
    closeCreateModal: () => setIsCreateModalVisible(false),
    itemToDelete,
    requestDelete: setItemToDelete,
    cancelDelete: () => setItemToDelete(null),
    confirmDelete,
  };
}
