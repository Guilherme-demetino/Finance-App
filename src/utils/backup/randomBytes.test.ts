import { createRandomBytes } from "./randomBytes";

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

describe("bytes aleatórios a partir de UUID v4", () => {
  it("usa só os bits aleatórios: sem o dígito da versão e sem o do variant", () => {
    const random = createRandomBytes(() => "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee");

    // 32 dígitos hexadecimais, menos o "4" (versão) e o "9" (variant) = 30 = 15 bytes
    expect(hex(random(15))).toBe("aaaaaaaabbbbcccdddeeeeeeeeeeee");
  });

  it("devolve exatamente o tamanho pedido, juntando vários UUIDs quando precisa", () => {
    let calls = 0;
    const random = createRandomBytes(() => {
      calls += 1;
      return `0000000${calls}-0000-4000-8000-000000000000`;
    });

    for (const length of [0, 1, 15, 16, 24, 30, 31, 45]) {
      calls = 0;
      expect(random(length).length).toBe(length);
      expect(calls).toBe(Math.ceil(length / 15));
    }
  });

  it("cada chamada usa UUIDs novos: 24 bytes seguidos não se repetem", () => {
    let n = 0;
    const random = createRandomBytes(() => {
      n += 1;
      return `${String(n).padStart(8, "0")}-1111-4222-a333-444444444444`;
    });

    expect(hex(random(24))).not.toBe(hex(random(24)));
  });

  it("recusa o que não é UUID v4 (o gerador nativo quebrado não pode virar chave fraca)", () => {
    for (const bad of ["", "abc", "00000000-0000-1000-8000-000000000000", "00000000-0000-4000-c000-000000000000", "zzzzzzzz-0000-4000-8000-000000000000"]) {
      expect(() => createRandomBytes(() => bad)(8)).toThrow("UUID inválido");
    }
  });
});
