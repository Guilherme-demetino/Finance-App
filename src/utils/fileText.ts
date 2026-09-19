/** Todo PDF começa com "%PDF-". */
export function isPdfBytes(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  );
}

/** Decodifica UTF-8; devolve null se os bytes não forem UTF-8 válido. */
function decodeUtf8Strict(bytes: Uint8Array): string | null {
  let result = "";
  let i = 0;

  while (i < bytes.length) {
    const byte = bytes[i];
    let codePoint: number;
    let extra: number;

    if (byte < 0x80) {
      codePoint = byte;
      extra = 0;
    } else if (byte >= 0xc2 && byte <= 0xdf) {
      codePoint = byte & 0x1f;
      extra = 1;
    } else if (byte >= 0xe0 && byte <= 0xef) {
      codePoint = byte & 0x0f;
      extra = 2;
    } else if (byte >= 0xf0 && byte <= 0xf4) {
      codePoint = byte & 0x07;
      extra = 3;
    } else {
      return null;
    }

    for (let k = 1; k <= extra; k++) {
      const next = bytes[i + k];
      if (next === undefined || (next & 0xc0) !== 0x80) return null;
      codePoint = (codePoint << 6) | (next & 0x3f);
    }

    result += String.fromCodePoint(codePoint);
    i += extra + 1;
  }

  return result;
}

/**
 * Transforma os bytes de um arquivo de texto em string. Tenta UTF-8 e, se
 * não for válido (muitos bancos brasileiros exportam CSV em ISO-8859-1),
 * cai para Latin-1, que preserva acentos como "ç" e "ã".
 */
export function decodeText(bytes: Uint8Array): string {
  const utf8 = decodeUtf8Strict(bytes);
  if (utf8 !== null) return utf8;

  let latin1 = "";
  for (let i = 0; i < bytes.length; i++) latin1 += String.fromCharCode(bytes[i]);
  return latin1;
}
