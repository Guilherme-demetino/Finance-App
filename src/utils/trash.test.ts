import { daysSinceDeleted, daysUntilPurge, describeTimeLeft, isPastRetention, TRASH_RETENTION_DAYS } from "./trash";

const TODAY = new Date(2026, 8, 21, 15, 0); // 21/09/2026, 15h
const deletedAt = (daysAgo: number) => new Date(TODAY.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

describe("dias desde que foi excluída", () => {
  it("conta dias completos, não importa a hora exata", () => {
    expect(daysSinceDeleted(deletedAt(0), TODAY)).toBe(0);
    expect(daysSinceDeleted(deletedAt(1), TODAY)).toBe(1);
    expect(daysSinceDeleted(deletedAt(10), TODAY)).toBe(10);
  });

  it("nunca fica negativo (relógio do aparelho mudou, por exemplo)", () => {
    const future = new Date(TODAY.getTime() + 60 * 60 * 1000).toISOString();
    expect(daysSinceDeleted(future, TODAY)).toBe(0);
  });
});

describe("dias até sumir de vez", () => {
  it(`é ${TRASH_RETENTION_DAYS} menos o que já passou`, () => {
    expect(daysUntilPurge(deletedAt(0), TODAY)).toBe(TRASH_RETENTION_DAYS);
    expect(daysUntilPurge(deletedAt(5), TODAY)).toBe(TRASH_RETENTION_DAYS - 5);
  });

  it("chega a zero no dia do prazo e fica negativo depois", () => {
    expect(daysUntilPurge(deletedAt(TRASH_RETENTION_DAYS), TODAY)).toBe(0);
    expect(daysUntilPurge(deletedAt(TRASH_RETENTION_DAYS + 3), TODAY)).toBe(-3);
  });
});

describe("isPastRetention", () => {
  it("verdadeiro só a partir do prazo (o dia do prazo já conta)", () => {
    expect(isPastRetention(deletedAt(TRASH_RETENTION_DAYS - 1), TODAY)).toBe(false);
    expect(isPastRetention(deletedAt(TRASH_RETENTION_DAYS), TODAY)).toBe(true);
    expect(isPastRetention(deletedAt(TRASH_RETENTION_DAYS + 1), TODAY)).toBe(true);
  });
});

describe("texto de quanto falta", () => {
  it("hoje, amanhã e em N dias", () => {
    expect(describeTimeLeft(deletedAt(TRASH_RETENTION_DAYS), TODAY)).toBe("Some hoje");
    expect(describeTimeLeft(deletedAt(TRASH_RETENTION_DAYS - 1), TODAY)).toBe("Some amanhã");
    expect(describeTimeLeft(deletedAt(0), TODAY)).toBe(`Some em ${TRASH_RETENTION_DAYS} dias`);
  });

  it("passou do prazo sem ter sido limpa ainda", () => {
    expect(describeTimeLeft(deletedAt(TRASH_RETENTION_DAYS + 2), TODAY)).toBe("Deveria ter sumido");
  });
});
