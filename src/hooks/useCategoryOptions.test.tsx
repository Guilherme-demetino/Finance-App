import React from "react";
import { act, create } from "react-test-renderer";

import { useCategoryOptions } from "./useCategoryOptions";

const mockGetAllCategories = jest.fn();
jest.mock("../database/categories", () => ({
  getAllCategories: (...args: unknown[]) => mockGetAllCategories(...args),
}));

const mockLogError = jest.fn();
jest.mock("../utils/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Result = ReturnType<typeof useCategoryOptions>;

function setup(initialVisible: boolean) {
  const seen: { value: Result | null } = { value: null };
  let setVisible!: (value: boolean) => void;

  function Harness() {
    const [visible, setV] = React.useState(initialVisible);
    setVisible = setV;
    seen.value = useCategoryOptions(visible);
    return null;
  }

  act(() => {
    create(<Harness />);
  });

  return { seen, setVisible: (value: boolean) => act(() => setVisible(value)) };
}

beforeEach(() => {
  mockGetAllCategories.mockReset();
  mockLogError.mockReset();
});

describe("useCategoryOptions", () => {
  it("invisível: não busca nada e começa vazio", () => {
    const { seen } = setup(false);

    expect(mockGetAllCategories).not.toHaveBeenCalled();
    expect(seen.value!.categories).toEqual([]);
    expect(seen.value!.isLoading).toBe(false);
  });

  it("ao ficar visível, busca as categorias", async () => {
    mockGetAllCategories.mockResolvedValue([{ id: 1, name: "Aluguel", color: "#111", type: "expense" }]);
    const { seen, setVisible } = setup(false);

    await act(async () => setVisible(true));

    expect(mockGetAllCategories).toHaveBeenCalledTimes(1);
    expect(seen.value!.categories).toEqual([{ id: 1, name: "Aluguel", color: "#111", type: "expense" }]);
    expect(seen.value!.isLoading).toBe(false);
  });

  it("erro ao buscar: registra o log e para de carregar", async () => {
    mockGetAllCategories.mockRejectedValue(new Error("falhou"));
    const { seen, setVisible } = setup(false);

    await act(async () => setVisible(true));

    expect(mockLogError).toHaveBeenCalledWith("Erro ao buscar categorias:", expect.any(Error));
    expect(seen.value!.isLoading).toBe(false);
    expect(seen.value!.categories).toEqual([]);
  });

  it("refresh() busca de novo e atualiza a lista", async () => {
    mockGetAllCategories.mockResolvedValue([]);
    const { seen } = setup(true);
    await act(async () => {});

    mockGetAllCategories.mockResolvedValue([{ id: 2, name: "Mercado", color: "#222", type: "expense" }]);
    await act(async () => {
      await seen.value!.refresh();
    });

    expect(seen.value!.categories).toEqual([{ id: 2, name: "Mercado", color: "#222", type: "expense" }]);
  });
});
