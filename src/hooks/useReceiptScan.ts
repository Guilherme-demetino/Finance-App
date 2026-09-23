import { useState } from "react";

import { scanReceiptFromCamera, scanReceiptFromLibrary, type ReceiptScanResult } from "../services/receiptScan";
import { formatCurrencyInput } from "../utils/currency";
import { logError } from "../utils/logger";
import { parseReceiptText } from "../utils/statements/receiptOcr";

interface UseReceiptScanParams {
  setTransactionType: (type: "income" | "expense") => void;
  setTransactionTitle: (title: string) => void;
  setTransactionAmount: (amount: string) => void;
  setTransactionDate: (date: string) => void;
  setTransactionCategory: (category: string) => void;
}

/** Fluxo de "fotografar recibo" do formulário de transação: tira/escolhe a foto, lê o texto e preenche os campos. */
export function useReceiptScan({
  setTransactionType,
  setTransactionTitle,
  setTransactionAmount,
  setTransactionDate,
  setTransactionCategory,
}: UseReceiptScanParams) {
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  /** Preenche o formulário com o que a leitura do recibo achou; o usuário sempre confere antes de salvar. */
  const applyScanResult = (result: ReceiptScanResult) => {
    if (result.status === "cancelled") return;
    if (result.status === "unsupported") {
      setScanError("Esse aparelho não suporta a leitura de recibo por foto.");
      return;
    }
    if (result.status === "permission-denied") {
      setScanError("Sem permissão para usar a câmera ou a galeria.");
      return;
    }
    if (result.status === "no-text") {
      setScanError("Não encontrei nenhum texto legível nessa foto. Tente uma foto mais nítida.");
      return;
    }
    if (result.status === "error") {
      setScanError("Não foi possível ler essa foto. Tente de novo.");
      return;
    }

    const parsed = parseReceiptText(result.text);
    setScanError(null);
    setTransactionType("expense");
    if (parsed.description) setTransactionTitle(parsed.description);
    if (parsed.amount !== null) {
      const rawCents = Math.round(parsed.amount * 100).toString();
      setTransactionAmount(formatCurrencyInput(rawCents));
    }
    setTransactionDate(parsed.date);
    if (parsed.category) setTransactionCategory(parsed.category);
  };

  const scanFromCamera = async () => {
    setScanError(null);
    setIsScanning(true);
    try {
      applyScanResult(await scanReceiptFromCamera());
    } catch (error) {
      logError("Erro ao escanear recibo (câmera):", error);
      setScanError("Não foi possível ler essa foto. Tente de novo.");
    } finally {
      setIsScanning(false);
    }
  };

  const scanFromLibrary = async () => {
    setScanError(null);
    setIsScanning(true);
    try {
      applyScanResult(await scanReceiptFromLibrary());
    } catch (error) {
      logError("Erro ao escanear recibo (galeria):", error);
      setScanError("Não foi possível ler essa foto. Tente de novo.");
    } finally {
      setIsScanning(false);
    }
  };

  return { isScanning, scanError, scanFromCamera, scanFromLibrary };
}
