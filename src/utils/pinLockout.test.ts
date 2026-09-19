import {
  attemptsBeforeFirstLock,
  describeDuration,
  EMPTY_LOCKOUT,
  formatCountdown,
  lockDurationMs,
  registerFailure,
  remainingLockMs,
  type LockoutState,
} from "./pinLockout";

const NOW = 1_000_000;

function failTimes(times: number, now = NOW): LockoutState {
  let state = EMPTY_LOCKOUT;
  for (let i = 0; i < times; i++) state = registerFailure(state, now);
  return state;
}

describe("lockDurationMs", () => {
  it("não bloqueia nas 4 primeiras tentativas erradas", () => {
    [0, 1, 2, 3, 4].forEach((n) => expect(lockDurationMs(n)).toBe(0));
  });

  it("cresce a partir do 5º erro e para em 1 hora", () => {
    expect([5, 6, 7, 8, 9, 10, 50].map(lockDurationMs)).toEqual([
      30_000,
      60_000,
      300_000,
      900_000,
      3_600_000,
      3_600_000,
      3_600_000,
    ]);
  });
});

describe("registerFailure", () => {
  it("conta os erros sem bloquear até o 4º", () => {
    const state = failTimes(4);
    expect(state).toEqual({ failures: 4, lockedUntil: 0 });
    expect(remainingLockMs(state, NOW)).toBe(0);
  });

  it("o 5º erro bloqueia por 30 segundos", () => {
    const state = failTimes(5);
    expect(state.lockedUntil).toBe(NOW + 30_000);
    expect(remainingLockMs(state, NOW)).toBe(30_000);
    expect(remainingLockMs(state, NOW + 10_000)).toBe(20_000);
    expect(remainingLockMs(state, NOW + 30_000)).toBe(0);
  });

  it("esperar o bloqueio acabar não perdoa: o erro seguinte bloqueia por mais tempo", () => {
    const first = failTimes(5);
    const later = NOW + 31_000;
    expect(remainingLockMs(first, later)).toBe(0);

    const next = registerFailure(first, later);
    expect(next.failures).toBe(6);
    expect(remainingLockMs(next, later)).toBe(60_000);
  });

  it("não muda o estado original", () => {
    const state = failTimes(2);
    registerFailure(state, NOW);
    expect(state.failures).toBe(2);
  });
});

describe("remainingLockMs", () => {
  it("relógio atrasado não deixa o app preso por mais que o bloqueio atual", () => {
    const state = failTimes(5);
    // relógio voltou 1 dia: sem o teto, sobrariam ~24 h
    expect(remainingLockMs(state, NOW - 24 * 3600 * 1000)).toBe(30_000);
  });

  it("estado sem bloqueio não tem tempo restante", () => {
    expect(remainingLockMs(EMPTY_LOCKOUT, NOW)).toBe(0);
  });
});

describe("attemptsBeforeFirstLock", () => {
  it("diz quantas tentativas ainda passam antes do bloqueio", () => {
    expect([0, 1, 2, 3, 4, 5, 8].map((n) => attemptsBeforeFirstLock(failTimes(n)))).toEqual(
      [5, 4, 3, 2, 1, 0, 0],
    );
  });
});

describe("formatação", () => {
  it("formatCountdown", () => {
    expect(formatCountdown(27_000)).toBe("0:27");
    expect(formatCountdown(26_100)).toBe("0:27"); // arredonda pra cima
    expect(formatCountdown(300_000)).toBe("5:00");
    expect(formatCountdown(3_600_000)).toBe("1:00:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("describeDuration", () => {
    expect(describeDuration(30_000)).toBe("30 segundos");
    expect(describeDuration(60_000)).toBe("1 minuto");
    expect(describeDuration(300_000)).toBe("5 minutos");
    expect(describeDuration(900_000)).toBe("15 minutos");
    expect(describeDuration(3_600_000)).toBe("1 hora");
  });
});
