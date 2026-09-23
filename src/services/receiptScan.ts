import * as ImagePicker from "expo-image-picker";
import { isSupported, recognizeText } from "expo-mlkit-ocr";

/**
 * Foto → texto (OCR no aparelho, via ML Kit). Sem rede: a foto nunca sai do aparelho. O texto lido
 * vira uma transação pré-preenchida com utils/statements/receiptOcr.ts (o usuário sempre confere e
 * pode editar antes de salvar).
 */
export type ReceiptScanResult =
  | { status: "cancelled" }
  | { status: "unsupported" }
  | { status: "permission-denied" }
  | { status: "no-text" }
  | { status: "error" }
  | { status: "ok"; text: string };

async function recognizeFromUri(uri: string): Promise<ReceiptScanResult> {
  try {
    const result = await recognizeText(uri);
    if (!result.text.trim()) return { status: "no-text" };
    return { status: "ok", text: result.text };
  } catch {
    return { status: "error" };
  }
}

export async function scanReceiptFromCamera(): Promise<ReceiptScanResult> {
  if (!isSupported()) return { status: "unsupported" };
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return { status: "permission-denied" };

  const picked = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (picked.canceled || !picked.assets[0]) return { status: "cancelled" };
  return recognizeFromUri(picked.assets[0].uri);
}

export async function scanReceiptFromLibrary(): Promise<ReceiptScanResult> {
  if (!isSupported()) return { status: "unsupported" };
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "permission-denied" };

  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (picked.canceled || !picked.assets[0]) return { status: "cancelled" };
  return recognizeFromUri(picked.assets[0].uri);
}
