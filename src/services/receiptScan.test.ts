import { scanReceiptFromCamera, scanReceiptFromLibrary } from "./receiptScan";

const mockImagePicker = {
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
};
const mockOcr = {
  isSupported: jest.fn(),
  recognizeText: jest.fn(),
};

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: (...args: unknown[]) => mockImagePicker.requestCameraPermissionsAsync(...args),
  requestMediaLibraryPermissionsAsync: (...args: unknown[]) => mockImagePicker.requestMediaLibraryPermissionsAsync(...args),
  launchCameraAsync: (...args: unknown[]) => mockImagePicker.launchCameraAsync(...args),
  launchImageLibraryAsync: (...args: unknown[]) => mockImagePicker.launchImageLibraryAsync(...args),
}));
jest.mock("expo-mlkit-ocr", () => ({
  isSupported: (...args: unknown[]) => mockOcr.isSupported(...args),
  recognizeText: (...args: unknown[]) => mockOcr.recognizeText(...args),
}));

beforeEach(() => {
  jest.resetAllMocks();
  mockOcr.isSupported.mockReturnValue(true);
});

describe("scanReceiptFromCamera", () => {
  it("aparelho sem suporte: nem chega a pedir permissão", async () => {
    mockOcr.isSupported.mockReturnValue(false);

    const result = await scanReceiptFromCamera();

    expect(result).toEqual({ status: "unsupported" });
    expect(mockImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
  });

  it("permissão negada", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await scanReceiptFromCamera();

    expect(result).toEqual({ status: "permission-denied" });
  });

  it("cancelar a foto", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: null });

    const result = await scanReceiptFromCamera();

    expect(result).toEqual({ status: "cancelled" });
  });

  it("foto tirada: reconhece o texto", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://foto.jpg" }] });
    mockOcr.recognizeText.mockResolvedValue({ text: "LOJA X\nTOTAL 10,00", blocks: [] });

    const result = await scanReceiptFromCamera();

    expect(mockOcr.recognizeText).toHaveBeenCalledWith("file://foto.jpg");
    expect(result).toEqual({ status: "ok", text: "LOJA X\nTOTAL 10,00" });
  });

  it("OCR não acha texto nenhum na foto", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://foto.jpg" }] });
    mockOcr.recognizeText.mockResolvedValue({ text: "   ", blocks: [] });

    const result = await scanReceiptFromCamera();

    expect(result).toEqual({ status: "no-text" });
  });

  it("o reconhecimento falha", async () => {
    mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ granted: true });
    mockImagePicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://foto.jpg" }] });
    mockOcr.recognizeText.mockRejectedValue(new Error("boom"));

    const result = await scanReceiptFromCamera();

    expect(result).toEqual({ status: "error" });
  });
});

describe("scanReceiptFromLibrary", () => {
  it("pede a permissão da galeria, não da câmera", async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: "file://foto.jpg" }] });
    mockOcr.recognizeText.mockResolvedValue({ text: "LOJA Y\nTOTAL 20,00", blocks: [] });

    const result = await scanReceiptFromLibrary();

    expect(mockImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "ok", text: "LOJA Y\nTOTAL 20,00" });
  });

  it("permissão da galeria negada", async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: false });

    const result = await scanReceiptFromLibrary();

    expect(result).toEqual({ status: "permission-denied" });
  });
});
