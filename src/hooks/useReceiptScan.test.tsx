import React from "react";
import { act, create } from "react-test-renderer";

import { useReceiptScan } from "./useReceiptScan";

const mockScan = {
  scanReceiptFromCamera: jest.fn(),
  scanReceiptFromLibrary: jest.fn(),
};
jest.mock("../services/receiptScan", () => ({
  scanReceiptFromCamera: (...args: unknown[]) => mockScan.scanReceiptFromCamera(...args),
  scanReceiptFromLibrary: (...args: unknown[]) => mockScan.scanReceiptFromLibrary(...args),
}));

const mockLogError = jest.fn();
jest.mock("../utils/logger", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Result = ReturnType<typeof useReceiptScan>;

function setup() {
  const seen: { value: Result | null } = { value: null };
  const setters = {
    setTransactionType: jest.fn(),
    setTransactionTitle: jest.fn(),
    setTransactionAmount: jest.fn(),
    setTransactionDate: jest.fn(),
    setTransactionCategory: jest.fn(),
  };

  function Harness() {
    seen.value = useReceiptScan(setters);
    return null;
  }

  act(() => {
    create(<Harness />);
  });

  return { seen, setters };
}

beforeEach(() => {
  mockScan.scanReceiptFromCamera.mockReset();
  mockScan.scanReceiptFromLibrary.mockReset();
  mockLogError.mockReset();
});

describe("useReceiptScan", () => {
  it("começa sem escanear e sem erro", () => {
    const { seen } = setup();

    expect(seen.value!.isScanning).toBe(false);
    expect(seen.value!.scanError).toBeNull();
  });

  it("leitura com sucesso: preenche os campos a partir do texto do recibo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({
      status: "ok",
      text: "SUPERMERCADO BOM PRECO\nTOTAL R$ 38,60\nDATA 15/09/2026",
    });
    const { seen, setters } = setup();

    await act(async () => {
      await seen.value!.scanFromCamera();
    });

    expect(setters.setTransactionType).toHaveBeenCalledWith("expense");
    expect(setters.setTransactionTitle).toHaveBeenCalledWith("SUPERMERCADO BOM PRECO");
    expect(setters.setTransactionAmount).toHaveBeenCalledWith("38,60");
    expect(setters.setTransactionDate).toHaveBeenCalledWith("15/09/2026");
    expect(seen.value!.isScanning).toBe(false);
    expect(seen.value!.scanError).toBeNull();
  });

  it("cancelar não mexe em nada nem mostra erro", async () => {
    mockScan.scanReceiptFromLibrary.mockResolvedValue({ status: "cancelled" });
    const { seen, setters } = setup();

    await act(async () => {
      await seen.value!.scanFromLibrary();
    });

    expect(setters.setTransactionTitle).not.toHaveBeenCalled();
    expect(seen.value!.scanError).toBeNull();
  });

  it("aparelho sem suporte: mostra o aviso certo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "unsupported" });
    const { seen } = setup();

    await act(async () => {
      await seen.value!.scanFromCamera();
    });

    expect(seen.value!.scanError).toBe("Esse aparelho não suporta a leitura de recibo por foto.");
  });

  it("permissão negada: mostra o aviso certo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "permission-denied" });
    const { seen } = setup();

    await act(async () => {
      await seen.value!.scanFromCamera();
    });

    expect(seen.value!.scanError).toBe("Sem permissão para usar a câmera ou a galeria.");
  });

  it("sem texto legível: mostra o aviso certo", async () => {
    mockScan.scanReceiptFromCamera.mockResolvedValue({ status: "no-text" });
    const { seen } = setup();

    await act(async () => {
      await seen.value!.scanFromCamera();
    });

    expect(seen.value!.scanError).toBe("Não encontrei nenhum texto legível nessa foto. Tente uma foto mais nítida.");
  });

  it("o reconhecimento falha (exceção): mostra o aviso e registra o log", async () => {
    mockScan.scanReceiptFromCamera.mockRejectedValue(new Error("boom"));
    const { seen } = setup();

    await act(async () => {
      await seen.value!.scanFromCamera();
    });

    expect(seen.value!.scanError).toBe("Não foi possível ler essa foto. Tente de novo.");
    expect(mockLogError).toHaveBeenCalledWith("Erro ao escanear recibo (câmera):", expect.any(Error));
  });
});
