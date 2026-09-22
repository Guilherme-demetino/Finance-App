import {
  describeOutlook,
  expectedSavingsPercent,
  formatMonthYear,
  MIN_DAYS_FOR_PACE,
  savingsOutlook,
  type SavingsGoalFacts,
} from "./savingsOutlook";

const goal = (over: Partial<SavingsGoalFacts> = {}): SavingsGoalFacts => ({
  saved_amount: 1000,
  target_amount: 5000,
  start_amount: 0,
  created_date: "01/01/2026",
  deadline: null,
  ...over,
});

// 01/03/2026: 59 dias depois de 01/01.
const TODAY = new Date(2026, 2, 1);

describe("savingsOutlook", () => {
  it("meta batida não tem projeção", () => {
    expect(savingsOutlook(goal({ saved_amount: 5000 }), TODAY)).toEqual({ kind: "done" });
    expect(savingsOutlook(goal({ saved_amount: 6000 }), TODAY)).toEqual({ kind: "done" });
  });

  it("meta nova demais (menos de 14 dias) ainda não projeta e diz quantos dias faltam", () => {
    const result = savingsOutlook(goal({ created_date: "25/02/2026" }), TODAY); // 4 dias

    expect(result).toEqual({ kind: "too-early", daysLeft: MIN_DAYS_FOR_PACE - 4 });
  });

  it("criada hoje: faltam os 14 dias inteiros", () => {
    expect(savingsOutlook(goal({ created_date: "01/03/2026" }), TODAY)).toEqual({ kind: "too-early", daysLeft: 14 });
  });

  it("sem nada guardado desde a criação: sem ritmo", () => {
    expect(savingsOutlook(goal({ saved_amount: 0 }), TODAY)).toEqual({ kind: "no-progress" });
  });

  it("o valor que já estava guardado ao criar a meta não conta como ritmo", () => {
    // Começou com 1000 e continua com 1000: nada foi guardado depois.
    expect(savingsOutlook(goal({ start_amount: 1000, saved_amount: 1000 }), TODAY)).toEqual({ kind: "no-progress" });
  });

  it("projeta pelo que foi guardado por mês desde o início", () => {
    // 59 dias e R$ 1.000 guardados: ~R$ 515,53/mês; faltam R$ 4.000 → ~7,76 meses.
    const result = savingsOutlook(goal(), TODAY);

    expect(result.kind).toBe("projected");
    if (result.kind !== "projected") return;
    expect(result.monthlyPace).toBeCloseTo(1000 / (59 / 30.4375), 2);
    expect(result.deadlineStatus).toBeNull();
    // Entre 7 e 8 meses depois de 01/03/2026: outubro/2026.
    expect(formatMonthYear(result.projectedDate)).toBe("out/2026");
  });

  it("dentro do prazo: a data projetada não passa do prazo", () => {
    const result = savingsOutlook(goal({ deadline: "31/12/2026" }), TODAY);

    expect(result).toMatchObject({ kind: "projected", deadlineStatus: "on-track", monthsLate: 0 });
  });

  it("depois do prazo: conta quantos meses de atraso, arredondando para cima", () => {
    const result = savingsOutlook(goal({ deadline: "31/07/2026" }), TODAY);

    expect(result).toMatchObject({ kind: "projected", deadlineStatus: "behind" });
    if (result.kind !== "projected") return;
    // Projeção em ~outubro: 2 a 3 meses depois do fim de julho.
    expect(result.monthsLate).toBeGreaterThanOrEqual(2);
    expect(result.monthsLate).toBeLessThanOrEqual(3);
  });

  it("guardar mais rápido projeta mais cedo", () => {
    const slow = savingsOutlook(goal({ saved_amount: 500 }), TODAY);
    const fast = savingsOutlook(goal({ saved_amount: 2500 }), TODAY);

    if (slow.kind !== "projected" || fast.kind !== "projected") throw new Error("esperava projeção");
    expect(fast.projectedDate.getTime()).toBeLessThan(slow.projectedDate.getTime());
  });

  it("ritmo baixo demais (décadas) vira um aviso, não uma data absurda", () => {
    const result = savingsOutlook(goal({ saved_amount: 1, target_amount: 1_000_000 }), TODAY);

    expect(result).toEqual({ kind: "too-slow" });
  });

  it("retirar dinheiro reduz o ritmo (o saldo guardado é o que conta)", () => {
    const before = savingsOutlook(goal({ saved_amount: 1500 }), TODAY);
    const after = savingsOutlook(goal({ saved_amount: 1000 }), TODAY);

    if (before.kind !== "projected" || after.kind !== "projected") throw new Error("esperava projeção");
    expect(after.monthlyPace).toBeLessThan(before.monthlyPace);
  });
});

describe("expectedSavingsPercent", () => {
  it("sem prazo não há marca", () => {
    expect(expectedSavingsPercent(goal(), TODAY)).toBeNull();
  });

  it("em linha reta da criação ao prazo", () => {
    // 01/01 → 31/12 (364 dias); em 01/03 passaram 59 dias.
    expect(expectedSavingsPercent(goal({ deadline: "31/12/2026" }), TODAY)).toBeCloseTo((59 / 364) * 100, 1);
  });

  it("parte do valor inicial: começar com metade já é esperar mais", () => {
    const percent = expectedSavingsPercent(goal({ start_amount: 2500, deadline: "31/12/2026" }), TODAY);

    expect(percent).toBeCloseTo(50 + (59 / 364) * 50, 1);
  });

  it("passou do prazo: 100%; antes de criar: 0%", () => {
    expect(expectedSavingsPercent(goal({ deadline: "31/01/2026" }), TODAY)).toBe(100);
    expect(expectedSavingsPercent(goal({ deadline: "31/12/2026" }), new Date(2025, 11, 1))).toBe(0);
  });

  it("prazo que não vem depois da criação não gera marca", () => {
    expect(expectedSavingsPercent(goal({ deadline: "01/01/2026" }), TODAY)).toBeNull();
  });
});

describe("describeOutlook", () => {
  it("cada situação vira uma frase e um tom", () => {
    expect(describeOutlook({ kind: "done" })).toBeNull();
    expect(describeOutlook({ kind: "too-early", daysLeft: 1 })).toEqual({
      text: "A projeção aparece depois de 14 dias de meta (faltam 1 dia).",
      tone: "muted",
    });
    expect(describeOutlook({ kind: "too-early", daysLeft: 9 })?.text).toContain("faltam 9 dias");
    expect(describeOutlook({ kind: "no-progress" })?.tone).toBe("muted");
    expect(describeOutlook({ kind: "too-slow" })?.tone).toBe("bad");
  });

  it("a projeção mostra o ritmo, a data e se está no prazo ou atrasada", () => {
    const projectedDate = new Date(2026, 9, 15);

    expect(describeOutlook({ kind: "projected", monthlyPace: 515.5, projectedDate, deadlineStatus: null, monthsLate: 0 })).toEqual({
      text: "No ritmo atual (R$ 515,50/mês) você chega lá em out/2026.",
      tone: "muted",
    });
    expect(describeOutlook({ kind: "projected", monthlyPace: 515.5, projectedDate, deadlineStatus: "on-track", monthsLate: 0 })).toEqual({
      text: "No ritmo atual (R$ 515,50/mês) você chega lá em out/2026, dentro do prazo.",
      tone: "good",
    });
    expect(describeOutlook({ kind: "projected", monthlyPace: 515.5, projectedDate, deadlineStatus: "behind", monthsLate: 1 })).toEqual({
      text: "No ritmo atual (R$ 515,50/mês) você chega lá em out/2026, 1 mês depois do prazo.",
      tone: "bad",
    });
    expect(describeOutlook({ kind: "projected", monthlyPace: 10, projectedDate, deadlineStatus: "behind", monthsLate: 3 })?.text).toContain("3 meses depois do prazo");
  });
});
