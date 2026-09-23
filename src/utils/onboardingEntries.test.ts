import { buildDebtEntries, buildInstallmentEntries, buildRecurringEntries } from "./onboardingEntries";

const colors = { income: "#0f0", expense: "#f00" };

describe("buildRecurringEntries", () => {
  it("monta uma linha por item, com ícone e cor de acordo com o tipo", () => {
    const onRemove = jest.fn();
    const [entry] = buildRecurringEntries(
      [{ id: "1", type: "income", title: "Salário", amount: 3000, day: 5, category: "Salário" }],
      colors,
      onRemove,
    );

    expect(entry.id).toBe("1");
    expect(entry.icon).toBe("arrow-down-outline");
    expect(entry.color).toBe(colors.income);
    expect(entry.subtitle).toBe("Todo dia 5 • Salário");
    expect(entry.amountText).toContain("3.000,00");

    entry.onRemove();
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("despesa fixa usa a cor e o ícone de despesa", () => {
    const [entry] = buildRecurringEntries(
      [{ id: "2", type: "expense", title: "Aluguel", amount: 1200, day: 10, category: "Moradia" }],
      colors,
      jest.fn(),
    );

    expect(entry.icon).toBe("arrow-up-outline");
    expect(entry.color).toBe(colors.expense);
  });
});

describe("buildInstallmentEntries", () => {
  it("mostra quantas parcelas faltam e o valor mensal", () => {
    const onRemove = jest.fn();
    const [entry] = buildInstallmentEntries(
      [
        {
          id: "1",
          title: "Celular",
          installmentAmount: 100,
          startNumber: 3,
          total: 10,
          firstDate: "10/10/2026",
          category: "Eletrônicos",
        },
      ],
      colors,
      onRemove,
    );

    expect(entry.subtitle).toBe("8 parcelas restantes • próxima em 10/10/2026");
    expect(entry.amountText).toContain("/mês");
    expect(entry.color).toBe(colors.expense);

    entry.onRemove();
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("no singular quando falta só uma parcela", () => {
    const [entry] = buildInstallmentEntries(
      [{ id: "1", title: "Sofá", installmentAmount: 50, startNumber: 6, total: 6, firstDate: "01/01/2027", category: "Casa" }],
      colors,
      jest.fn(),
    );

    expect(entry.subtitle).toContain("1 parcela restante");
  });
});

describe("buildDebtEntries", () => {
  it("'lent' (te devem): cor de receita e texto 'Te deve'", () => {
    const onRemove = jest.fn();
    const [entry] = buildDebtEntries(
      [{ id: "1", person: "Ana", amount: 200, type: "lent", description: null, dueDate: "20/10/2026" }],
      colors,
      onRemove,
    );

    expect(entry.icon).toBe("arrow-down-outline");
    expect(entry.color).toBe(colors.income);
    expect(entry.title).toBe("Ana");
    expect(entry.subtitle).toBe("Te deve • até 20/10/2026");

    entry.onRemove();
    expect(onRemove).toHaveBeenCalledWith("1");
  });

  it("'borrowed' (você deve): cor de despesa, sem data marcada se não houver", () => {
    const [entry] = buildDebtEntries(
      [{ id: "1", person: "Banco", amount: 500, type: "borrowed", description: null, dueDate: null }],
      colors,
      jest.fn(),
    );

    expect(entry.icon).toBe("arrow-up-outline");
    expect(entry.color).toBe(colors.expense);
    expect(entry.subtitle).toBe("Você deve");
  });
});
