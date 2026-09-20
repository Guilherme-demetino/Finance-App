import type { RandomBytes } from "./encryption";

/**
 * Bytes aleatórios seguros a partir de UUIDs v4. O app não tem `crypto.getRandomValues`,
 * mas o `expo-modules-core` gera UUID v4 no lado nativo (no Android, `UUID.randomUUID()`,
 * que usa o gerador seguro do sistema). Um UUID v4 tem 122 bits aleatórios: os 4 dígitos
 * hexadecimais fixos (versão) e os 2 bits do "variant" saem, sobrando 30 dígitos = 15 bytes
 * totalmente aleatórios por UUID.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BYTES_PER_UUID = 15;

export function createRandomBytes(uuidv4: () => string): RandomBytes {
  return (length) => {
    const out = new Uint8Array(length);
    let filled = 0;
    while (filled < length) {
      const uuid = uuidv4();
      if (!UUID_V4.test(uuid)) throw new Error("O gerador de números aleatórios devolveu um UUID inválido.");
      // Tira o "-" e o dígito da versão (posição 12) e o do variant (16): sobram só bits aleatórios.
      const hex = uuid.replace(/-/g, "");
      const random = hex.slice(0, 12) + hex.slice(13, 16) + hex.slice(17);
      for (let i = 0; i < BYTES_PER_UUID && filled < length; i++) {
        out[filled++] = parseInt(random.slice(i * 2, i * 2 + 2), 16);
      }
    }
    return out;
  };
}
