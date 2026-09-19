import { EMPTY_LOCKOUT, registerFailure } from "./pinLockout";
import {
  clearPin,
  getLockoutState,
  saveLockoutState,
  savePin,
} from "./security";

const mockStore = new Map<string, string>();

jest.mock("expo-secure-store", () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

describe("contador de tentativas do PIN", () => {
  beforeEach(() => mockStore.clear());

  it("começa vazio", async () => {
    await expect(getLockoutState()).resolves.toEqual(EMPTY_LOCKOUT);
  });

  it("guarda e devolve o estado (sobrevive a reabrir o app)", async () => {
    let state = EMPTY_LOCKOUT;
    for (let i = 0; i < 5; i++) state = registerFailure(state, 1000);
    await saveLockoutState(state);

    await expect(getLockoutState()).resolves.toEqual({
      failures: 5,
      lockedUntil: 31_000,
    });
  });

  it("dado corrompido não trava o app: volta para vazio", async () => {
    mockStore.set("finance_app_pin_lockout", "{isso não é json");
    await expect(getLockoutState()).resolves.toEqual(EMPTY_LOCKOUT);

    mockStore.set("finance_app_pin_lockout", JSON.stringify({ failures: "x" }));
    await expect(getLockoutState()).resolves.toEqual(EMPTY_LOCKOUT);
  });

  it("cadastrar um PIN novo zera a contagem", async () => {
    await saveLockoutState({ failures: 7, lockedUntil: 999_999 });
    await savePin("1234");
    await expect(getLockoutState()).resolves.toEqual(EMPTY_LOCKOUT);
  });

  it("zerar o app apaga o PIN e a contagem", async () => {
    await savePin("1234");
    await saveLockoutState({ failures: 6, lockedUntil: 999_999 });

    await clearPin();

    expect(mockStore.size).toBe(0);
  });
});
