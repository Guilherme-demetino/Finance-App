import {
  createKdfParams,
  decryptBackupText,
  deriveKey,
  encryptBackupText,
  ENCRYPTED_BACKUP_FORMAT,
  fromBase64,
  isEncryptedBackup,
  keyFromBase64,
  keyToBase64,
  normalizePassword,
  parseEncryptedBackup,
  sameKdf,
  toBase64,
  utf8Decode,
  utf8Encode,
  validatePassword,
  WrongPasswordError,
  type EncryptedBackup,
  type RandomBytes,
} from "./encryption";

/** Aleatoriedade de mentira e repetível: cada chamada devolve bytes diferentes. */
function createRandom(): RandomBytes {
  let counter = 1;
  return (length) => Uint8Array.from({ length }, () => (counter++ * 37) % 251);
}

// Custo baixo só para os testes rodarem rápido; o padrão de verdade é conferido à parte.
const FAST = { N: 1024, r: 8, p: 1 };
const PLAIN = JSON.stringify({ format: "meu-financeiro-backup", version: 1, data: { userName: "José ✓ 😀" } });

async function encrypted(password = "frase longa de teste") {
  const random = createRandom();
  const kdf = createKdfParams(random, FAST);
  const key = await deriveKey(password, kdf);
  return { random, kdf, key, text: encryptBackupText(PLAIN, key, kdf, random) };
}

const envelopeOf = (text: string): EncryptedBackup => {
  const parsed = parseEncryptedBackup(text);
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.envelope;
};

describe("base64 e UTF-8", () => {
  it("bate com os vetores da RFC 4648", () => {
    const cases: [string, string][] = [
      ["", ""],
      ["f", "Zg=="],
      ["fo", "Zm8="],
      ["foo", "Zm9v"],
      ["foob", "Zm9vYg=="],
      ["fooba", "Zm9vYmE="],
      ["foobar", "Zm9vYmFy"],
    ];
    for (const [text, b64] of cases) {
      expect(toBase64(utf8Encode(text))).toBe(b64);
      expect(utf8Decode(fromBase64(b64) as Uint8Array)).toBe(text);
    }
  });

  it("ida e volta com todos os tamanhos e todos os valores de byte", () => {
    for (let length = 0; length < 40; length++) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 53 + length) % 256);
      expect(Array.from(fromBase64(toBase64(bytes)) as Uint8Array)).toEqual(Array.from(bytes));
    }
  });

  it("recusa base64 inválido", () => {
    for (const bad of ["abc", "ab=c", "====", "aGVsbG8", "aGVs bG8=", "aGVsbG8=="]) {
      expect(fromBase64(bad)).toBeNull();
    }
  });

  it("UTF-8 igual ao do TextEncoder, com acento, símbolo e emoji", () => {
    for (const text of ["", "abc", "José", "ação — ç", "✓ 中文", "😀 emoji 🎉"]) {
      expect(Array.from(utf8Encode(text))).toEqual(Array.from(new TextEncoder().encode(text)));
      expect(utf8Decode(utf8Encode(text))).toBe(text);
    }
  });
});

describe("senha", () => {
  it("exige o tamanho mínimo e a confirmação igual", () => {
    expect(validatePassword("curta")).toContain("pelo menos 8 caracteres");
    expect(validatePassword("12345678")).toBeNull();
    expect(validatePassword("12345678", "12345679")).toBe("As duas senhas não são iguais.");
    expect(validatePassword("12345678", "12345678")).toBeNull();
  });

  it("conta caracteres e não bytes: emoji e acento valem um cada", () => {
    expect(validatePassword("ééééééé")).not.toBeNull(); // 7
    expect(validatePassword("éééééééé")).toBeNull(); // 8
    expect(validatePassword("😀😀😀😀😀😀😀😀")).toBeNull();
  });

  it("normaliza (NFKC): o mesmo é digitado de jeitos diferentes por teclados diferentes", async () => {
    const composed = "café com leite";
    const decomposed = "café com leite";
    expect(composed).not.toBe(decomposed);
    expect(normalizePassword(decomposed)).toBe(normalizePassword(composed));

    const kdf = createKdfParams(createRandom(), FAST);
    expect(keyToBase64(await deriveKey(composed, kdf))).toBe(keyToBase64(await deriveKey(decomposed, kdf)));
  });
});

describe("chave", () => {
  it("parâmetros novos: scrypt de 32 MiB, sal de 16 bytes, sal diferente a cada vez", () => {
    const random = createRandom();
    const a = createKdfParams(random);
    const b = createKdfParams(random);

    expect(a).toMatchObject({ name: "scrypt", N: 32768, r: 8, p: 1 });
    expect((fromBase64(a.salt) as Uint8Array).length).toBe(16);
    expect(a.salt).not.toBe(b.salt);
    expect(sameKdf(a, { ...a })).toBe(true);
    expect(sameKdf(a, b)).toBe(false);
  });

  it("é determinística: mesma senha e mesmo sal, mesma chave de 32 bytes; senha diferente, outra chave", async () => {
    const random = createRandom();
    const kdf = createKdfParams(random, FAST);
    const one = await deriveKey("uma senha boa", kdf);

    expect(one.length).toBe(32);
    expect(keyToBase64(await deriveKey("uma senha boa", kdf))).toBe(keyToBase64(one));
    expect(keyToBase64(await deriveKey("uma senha boa!", kdf))).not.toBe(keyToBase64(one));
    // Outro sal (a fonte segue de onde parou), outra chave.
    expect(keyToBase64(await deriveKey("uma senha boa", createKdfParams(random, FAST)))).not.toBe(keyToBase64(one));
  });

  it("a chave guardada em base64 volta igual; tamanho errado é recusado", async () => {
    const { key } = await encrypted();

    expect(Array.from(keyFromBase64(keyToBase64(key)) as Uint8Array)).toEqual(Array.from(key));
    expect(keyFromBase64(toBase64(new Uint8Array(16)))).toBeNull();
    expect(keyFromBase64("lixo")).toBeNull();
  });

  it("com os parâmetros padrão de verdade (N=2^15) também abre", async () => {
    const random = createRandom();
    const kdf = createKdfParams(random);
    const key = await deriveKey("senha do custo padrão", kdf);

    const text = encryptBackupText(PLAIN, key, kdf, random);

    expect(decryptBackupText(envelopeOf(text), await deriveKey("senha do custo padrão", kdf))).toBe(PLAIN);
  });
});

describe("cifrar e decifrar", () => {
  it("ida e volta devolve exatamente o texto original (acentos e emoji inclusos)", async () => {
    const { text, key } = await encrypted();

    expect(decryptBackupText(envelopeOf(text), key)).toBe(PLAIN);
  });

  it("o arquivo não mostra nada do conteúdo e se identifica como backup protegido", async () => {
    const { text } = await encrypted();

    expect(text.startsWith(`{"format":"${ENCRYPTED_BACKUP_FORMAT}"`)).toBe(true);
    expect(text).not.toContain("José");
    expect(text).not.toContain("userName");
    expect(text).not.toContain("meu-financeiro-backup\"");
    expect(JSON.parse(text)).toMatchObject({ version: 1, cipher: "xchacha20poly1305", kdf: { name: "scrypt", ...FAST } });
  });

  it("cada arquivo tem um nonce novo: o mesmo conteúdo nunca sai igual duas vezes", async () => {
    const { random, kdf, key } = await encrypted();

    const first = encryptBackupText(PLAIN, key, kdf, random);
    const second = encryptBackupText(PLAIN, key, kdf, random);

    expect(envelopeOf(first).nonce).not.toBe(envelopeOf(second).nonce);
    expect(envelopeOf(first).ciphertext).not.toBe(envelopeOf(second).ciphertext);
  });

  it("senha errada é detectada, e não vira lixo", async () => {
    const { text, kdf } = await encrypted("senha certa aqui");
    const wrong = await deriveKey("senha errada aqui", kdf);

    expect(() => decryptBackupText(envelopeOf(text), wrong)).toThrow(WrongPasswordError);
    expect(() => decryptBackupText(envelopeOf(text), wrong)).toThrow("Senha incorreta ou arquivo alterado.");
  });

  it("arquivo alterado é detectado: conteúdo, nonce e cada campo do cabeçalho", async () => {
    const { text, key } = await encrypted();
    const original = envelopeOf(text);

    const flipped = fromBase64(original.ciphertext) as Uint8Array;
    flipped[3] ^= 1;
    const tampered: EncryptedBackup[] = [
      { ...original, ciphertext: toBase64(flipped) },
      { ...original, nonce: toBase64(new Uint8Array(24).fill(9)) },
      { ...original, kdf: { ...original.kdf, N: 2048 } },
      { ...original, kdf: { ...original.kdf, r: 4 } },
      { ...original, kdf: { ...original.kdf, salt: toBase64(new Uint8Array(16).fill(1)) } },
      { ...original, version: 2 },
    ];

    for (const envelope of tampered) {
      expect(() => decryptBackupText(envelope, key)).toThrow(WrongPasswordError);
    }
  });
});

describe("ler o envelope", () => {
  it("aceita um envelope válido e reconhece como protegido", async () => {
    const { text } = await encrypted();

    expect(parseEncryptedBackup(text)).toMatchObject({ ok: true });
    expect(isEncryptedBackup(text)).toBe(true);
  });

  it("outros arquivos não são backup protegido (o chamador segue o caminho normal)", () => {
    for (const other of [PLAIN, "data;descricao;valor\n01/09/2026;x;1", "", "não é json", "[]", "null", '{"format":"outro"}']) {
      expect(parseEncryptedBackup(other)).toMatchObject({ ok: false, reason: "not-encrypted" });
      expect(isEncryptedBackup(other)).toBe(false);
    }
  });

  it("recusa envelope com campos faltando ou fora do aceito, dizendo que é inválido", async () => {
    const { text } = await encrypted();
    const good = JSON.parse(text);
    const broken: Record<string, unknown>[] = [
      { ...good, version: 0 },
      { ...good, version: "1" },
      { ...good, cipher: "aes-cbc" },
      { ...good, kdf: undefined },
      { ...good, kdf: { ...good.kdf, name: "pbkdf2" } },
      { ...good, kdf: { ...good.kdf, N: 1000 } }, // não é potência de 2
      { ...good, kdf: { ...good.kdf, N: 2 ** 20 } }, // memória demais
      { ...good, kdf: { ...good.kdf, N: 2 ** 9 } },
      { ...good, kdf: { ...good.kdf, r: 16 } },
      { ...good, kdf: { ...good.kdf, p: 0 } },
      { ...good, kdf: { ...good.kdf, p: 5 } },
      { ...good, kdf: { ...good.kdf, salt: toBase64(new Uint8Array(8)) } },
      { ...good, kdf: { ...good.kdf, salt: "@@@" } },
      { ...good, nonce: toBase64(new Uint8Array(12)) },
      { ...good, ciphertext: toBase64(new Uint8Array(8)) },
      { ...good, ciphertext: undefined },
    ];

    for (const candidate of broken) {
      const parsed = parseEncryptedBackup(JSON.stringify(candidate));
      expect(parsed).toMatchObject({ ok: false, reason: "invalid" });
      expect((parsed as { error: string }).error).toContain("Backup protegido inválido");
      expect(isEncryptedBackup(JSON.stringify(candidate))).toBe(true);
    }
  });

  it("versão mais nova do app: pede para atualizar", async () => {
    const { text } = await encrypted();

    const parsed = parseEncryptedBackup(JSON.stringify({ ...JSON.parse(text), version: 2 }));

    expect(parsed).toMatchObject({ ok: false, reason: "newer" });
    expect((parsed as { error: string }).error).toContain("Atualize o app");
  });
});
