import { decodeText, isPdfBytes } from "./fileText";

describe("isPdfBytes", () => {
  it("reconhece o cabeçalho %PDF-", () => {
    expect(isPdfBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]))).toBe(true);
    expect(isPdfBytes(new TextEncoder().encode("Data;Valor"))).toBe(false);
    expect(isPdfBytes(new Uint8Array([]))).toBe(false);
  });
});

describe("decodeText", () => {
  it("decodifica UTF-8 com acentos e emoji", () => {
    const bytes = new TextEncoder().encode("Descrição ação 😀");
    expect(decodeText(bytes)).toBe("Descrição ação 😀");
  });

  it("cai para Latin-1 quando não é UTF-8 (CSV de banco em ISO-8859-1)", () => {
    // "Descrição" em ISO-8859-1: ç = 0xE7, ã = 0xE3
    const bytes = new Uint8Array([0x44, 0x65, 0x73, 0x63, 0x72, 0x69, 0xe7, 0xe3, 0x6f]);
    expect(decodeText(bytes)).toBe("Descrição");
  });
});
