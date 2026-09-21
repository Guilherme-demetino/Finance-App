import React from "react";
import { Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { createSqlJsDatabase } from "../test/sqliteFake";
import { planPurchase } from "../utils/creditCards";
import CardsScreen from "../app/dashboard/cards";

// Banco de verdade em memória: a tela, o hook e o SQL rodam juntos.
const mockState: { db: unknown } = { db: null };
const mockPick: { bytes: Uint8Array | null } = { bytes: null };

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("../services/pickFileBytes", () => ({ pickFileBytes: async () => mockPick.bytes }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-reanimated", () => jest.requireActual("../test/reanimatedMock").createReanimatedMock());
// O calendário tem testes próprios.
jest.mock("../components/forms/CalendarPicker", () => ({ CalendarPicker: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

const field = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};

/** O botão mais interno com esse rótulo ou texto (o último achado). */
function button(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter(
      (node) =>
        node.props.accessibilityLabel === label || node.findAllByType(RNText).some((t) => flat(t.props.children) === label),
    );
  if (matches.length === 0) throw new Error(`botão "${label}" não encontrado\n${textOf(tree)}`);
  return matches[matches.length - 1];
}

/** O botão cujo rótulo começa com o prefixo (para rótulos com datas e valores). */
function buttonStartingWith(tree: ReactTestRenderer, prefix: string) {
  const found = tree.root.findAllByType(TouchableOpacity).find((node) => String(node.props.accessibilityLabel ?? "").startsWith(prefix));
  if (!found) throw new Error(`botão que começa com "${prefix}" não encontrado
${textOf(tree)}`);
  return found;
}
const pressStartingWith = async (tree: ReactTestRenderer, prefix: string) => {
  await act(async () => {
    await buttonStartingWith(tree, prefix).props.onPress();
  });
};

const press = async (tree: ReactTestRenderer, label: string) => {
  await act(async () => {
    await button(tree, label).props.onPress();
  });
};
const type = (tree: ReactTestRenderer, label: string, value: string) => act(() => field(tree, label).props.onChangeText(value));

async function mount(): Promise<ReactTestRenderer> {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(<CardsScreen />);
  });
  mounted.push(tree);
  return tree;
}

async function database() {
  return {
    cards: jest.requireActual<typeof import("../database/creditCards")>("../database/creditCards"),
    transactions: jest.requireActual<typeof import("../database/transactions")>("../database/transactions"),
  };
}

const daysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

beforeEach(async () => {
  mockState.db = await createSqlJsDatabase();
  const { resetDatabase } = jest.requireActual<typeof import("../database/sqlite")>("../database/sqlite");
  await resetDatabase();
  mockPick.bytes = null;
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("tela de cartões", () => {
  it("sem cartões explica o que fazer e explica a regra do saldo", async () => {
    const tree = await mount();

    expect(textOf(tree)).toContain("Nenhum cartão ainda");
    expect(textOf(tree)).toContain("fora do seu saldo até você pagar a fatura");
  });

  it("cria um cartão pelo formulário; dia inválido avisa e não grava", async () => {
    const tree = await mount();
    await press(tree, "Adicionar cartão");

    type(tree, "Nome do cartão", "Nubank");
    type(tree, "Dia do vencimento", "5");
    await press(tree, "Criar cartão");
    expect(textOf(tree)).toContain("O dia de fechamento precisa estar entre 1 e 31.");

    type(tree, "Dia do fechamento", "28");
    type(tree, "Limite do cartão", "500000");
    await press(tree, "Criar cartão");

    expect(textOf(tree)).toContain("Cartão criado.");
    expect(textOf(tree)).toContain("Nubank");
    expect(textOf(tree)).toContain("Fecha dia 28 · vence dia 5");
    expect(textOf(tree)).toContain("Disponível R$ 5.000,00");
    expect(textOf(tree)).not.toContain("Criar cartão");
  });

  it("edita o cartão, com o formulário já preenchido", async () => {
    const { cards } = await database();
    await cards.createCreditCard({ name: "Inter", closingDay: 10, dueDay: 17, limit: null });
    const tree = await mount();

    await press(tree, "Editar cartão Inter");
    expect(field(tree, "Nome do cartão").props.value).toBe("Inter");
    expect(field(tree, "Dia do fechamento").props.value).toBe("10");
    type(tree, "Dia do vencimento", "20");
    await press(tree, "Salvar alterações");

    expect(textOf(tree)).toContain("Cartão atualizado.");
    expect(textOf(tree)).toContain("Fecha dia 10 · vence dia 20");
  });

  it("lança uma compra parcelada e mostra em qual fatura cada parcela caiu", async () => {
    const { cards } = await database();
    await cards.createCreditCard({ name: "Nubank", closingDay: 31, dueDay: 5, limit: null });
    const tree = await mount();

    await press(tree, "Nova compra no Nubank");
    expect(textOf(tree)).toContain("Entra na fatura de");
    type(tree, "Descrição da compra", "Notebook");
    type(tree, "Valor da compra", "90000");
    type(tree, "Número de parcelas", "3");
    expect(textOf(tree)).toContain("3x de R$ 300,00");
    await press(tree, "Lançar compra");

    expect(textOf(tree)).toContain("Compra lançada.");
    expect(textOf(tree)).toContain("Usado R$ 900,00");
    const stored = await cards.getAllCardPurchases();
    expect(stored.map((row) => row.amount)).toEqual([300, 300, 300]);
    expect(new Set(stored.map((row) => row.invoice_ref)).size).toBe(3);
  });

  it("compra sem descrição ou sem valor não grava", async () => {
    const { cards } = await database();
    await cards.createCreditCard({ name: "Nubank", closingDay: 31, dueDay: 5, limit: null });
    const tree = await mount();
    await press(tree, "Nova compra no Nubank");

    await press(tree, "Lançar compra");
    expect(textOf(tree)).toContain("Descreva a compra.");

    type(tree, "Descrição da compra", "Mercado");
    await press(tree, "Lançar compra");
    expect(textOf(tree)).toContain("Digite o valor da compra.");
    expect(await cards.getAllCardPurchases()).toEqual([]);
  });

  it("abre a fatura, edita e exclui uma compra", async () => {
    const { cards } = await database();
    await cards.createCreditCard({ name: "Nubank", closingDay: 31, dueDay: 5, limit: null });
    const [card] = await cards.getAllCreditCards();
    await cards.addCardPurchases(
      planPurchase({ card, description: "Mercado", totalAmount: 80, date: new Date(), category: "Alimentação", installments: 1, groupId: "g" }),
    );
    const tree = await mount();

    await pressStartingWith(tree, "Fatura Nubank");
    expect(textOf(tree)).toContain("Mercado");

    await press(tree, "Editar compra Mercado");
    expect(field(tree, "Descrição da compra").props.value).toBe("Mercado");
    expect(field(tree, "Valor da compra").props.value).toBe("80,00");
    type(tree, "Valor da compra", "9000");
    await press(tree, "Salvar alterações");
    expect(textOf(tree)).toContain("Compra atualizada.");
    expect((await cards.getAllCardPurchases())[0].amount).toBe(90);

    await press(tree, "Excluir compra Mercado");
    expect(textOf(tree)).toContain('Apagar "Mercado" da fatura?');
    await press(tree, "Excluir");

    expect(textOf(tree)).toContain("Compra excluída.");
    expect(await cards.getAllCardPurchases()).toEqual([]);
  });
});

describe("pagar a fatura pela tela", () => {
  async function seedOverdueInvoice() {
    const cards = (await database()).cards;
    await cards.createCreditCard({ name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    const [card] = await cards.getAllCreditCards();
    await cards.addCardPurchases(
      planPurchase({ card, description: "TV", totalAmount: 1200, date: daysAgo(90), category: "Outros", installments: 1, groupId: "g" }),
    );
    return { cards, card };
  }

  it("fatura vencida mostra o valor, pede confirmação e cria a despesa no saldo", async () => {
    const { cards } = await seedOverdueInvoice();
    const { transactions } = await database();
    const tree = await mount();
    const summary = buttonStartingWith(tree, "Fatura Inter").props.accessibilityLabel;
    expect(summary).toContain("Vencida");
    expect(summary).toContain("R$ 1.200,00");

    await pressStartingWith(tree, "Fatura Inter");
    await pressStartingWith(tree, "Pagar fatura");
    expect(textOf(tree)).toContain("Registrar o pagamento da fatura");
    await press(tree, "Pagar");

    expect(textOf(tree)).toContain("Fatura paga. A despesa entrou no seu saldo.");
    const [expense] = await transactions.getAllTransactions();
    expect(expense).toMatchObject({ amount: 1200, category_id: "Cartão de crédito", type: "expense" });
    expect(await cards.getAllCardPayments()).toHaveLength(1);
    // Paga: some da lista até pedir para mostrar as pagas.
    expect(textOf(tree)).toContain("Mostrar faturas pagas (1)");
  });

  it("fatura ainda aberta também tem o botão de pagar, com o aviso de que ela deixa de receber compras", async () => {
    const { cards, transactions } = await database();
    await cards.createCreditCard({ name: "Nubank", closingDay: 31, dueDay: 5, limit: null });
    const [card] = await cards.getAllCreditCards();
    await cards.addCardPurchases(
      planPurchase({ card, description: "Mercado", totalAmount: 80, date: new Date(), category: "Alimentação", installments: 1, groupId: "g" }),
    );
    const tree = await mount();

    await pressStartingWith(tree, "Fatura Nubank");
    expect(textOf(tree)).toContain("Se pagar agora, ela não recebe mais compras.");
    await pressStartingWith(tree, "Pagar fatura");
    expect(textOf(tree)).toContain("Ela ainda está aberta: depois de paga, não recebe mais compras");
    await press(tree, "Pagar");

    expect(textOf(tree)).toContain("Fatura paga. A despesa entrou no seu saldo.");
    expect((await transactions.getAllTransactions())[0]).toMatchObject({ amount: 80, category_id: "Cartão de crédito" });
    expect(await cards.getAllCardPayments()).toHaveLength(1);
  });

  it("desfazer o pagamento devolve a fatura e tira a despesa", async () => {
    const { cards, card } = await seedOverdueInvoice();
    const { transactions } = await database();
    await cards.payInvoice({ cardId: card.id, cardName: "Inter", ref: (await cards.getAllCardPurchases())[0].invoice_ref, amount: 1200, paidDate: "01/01/2026" });
    const tree = await mount();

    await press(tree, "Mostrar faturas pagas (1)");
    // A fatura atual (sem compras) vem antes da paga: abre a que está paga.
    const paidInvoice = tree.root.findAllByType(TouchableOpacity).find((node) => String(node.props.accessibilityLabel ?? "").includes(", Paga,"));
    await act(async () => paidInvoice!.props.onPress());
    expect(textOf(tree)).toContain("Paga em 01/01/2026");
    await pressStartingWith(tree, "Desfazer pagamento da fatura");
    await press(tree, "Desfazer");

    expect(textOf(tree)).toContain("Pagamento desfeito");
    expect(await cards.getAllCardPayments()).toEqual([]);
    expect(await transactions.getAllTransactions()).toEqual([]);
  });

  it("excluir o cartão pede confirmação e apaga tudo dele", async () => {
    const { cards } = await seedOverdueInvoice();
    const tree = await mount();

    await press(tree, "Excluir cartão Inter");
    expect(textOf(tree)).toContain("Apagar o cartão Inter");
    await press(tree, "Excluir");

    expect(textOf(tree)).toContain("Cartão excluído.");
    expect(await cards.getAllCreditCards()).toEqual([]);
    expect(await cards.getAllCardPurchases()).toEqual([]);
  });
});

describe("importar a fatura pela tela", () => {
  const bytesOf = (text: string) => new TextEncoder().encode(text);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const csv = () =>
    [
      "date,category,title,amount",
      `${iso(daysAgo(90))},alimentação,Mercado,60.00`,
      `${iso(daysAgo(90))},casa,Notebook - Parcela 2/5,40.00`,
      `${iso(daysAgo(90))},estorno,Estorno Loja,-15.00`,
    ].join("\n");

  async function seedCard() {
    const { cards } = await database();
    await cards.createCreditCard({ name: "Inter", closingDay: 10, dueDay: 20, limit: null });
    return cards;
  }

  const confirmButton = (tree: ReactTestRenderer, label: string) => button(tree, label);

  it("mostra a conferência, importa as compras e avisa em qual fatura entraram", async () => {
    const cards = await seedCard();
    const tree = await mount();
    mockPick.bytes = bytesOf(csv());

    await press(tree, "Importar fatura do Inter");

    expect(textOf(tree)).toContain("Importar fatura do Inter");
    expect(textOf(tree)).toContain("2 compras novas (R$ 100,00)");
    expect(textOf(tree)).toContain("Ignoradas: 1 estorno/saldo");
    expect(textOf(tree)).toContain("Notebook (2/5)");
    expect(await cards.getAllCardPurchases()).toEqual([]); // nada gravado antes de confirmar

    await press(tree, "Importar 2 compras");

    expect(textOf(tree)).toMatch(/Importado na fatura de [A-Z]{3}\/\d{4}: 2 compras\./);
    expect(await cards.getAllCardPurchases()).toHaveLength(2);
  });

  it("pagamento recebido aparece como pagamento antecipado e desconta do total da fatura", async () => {
    const cards = await seedCard();
    const tree = await mount();
    mockPick.bytes = bytesOf(`${csv()}
${iso(daysAgo(90))},pagamento,Pagamento recebido,-30.00`);

    await press(tree, "Importar fatura do Inter");

    expect(textOf(tree)).toContain("2 compras novas (R$ 100,00)");
    expect(textOf(tree)).toContain("1 pagamento antecipado (− R$ 30,00)");
    expect(textOf(tree)).toContain("a fatura fica em R$ 70,00");
    await press(tree, "Importar 2 compras e 1 pagamento");

    expect(textOf(tree)).toMatch(/Importado na fatura de [A-Z]{3}\/\d{4}: 2 compras e 1 pagamento antecipado\./);
    expect((await cards.getAllCardPurchases()).map((row) => row.amount).sort((a, b) => a - b)).toEqual([-30, 40, 60]);
    // A fatura mostra o total já descontado.
    expect(buttonStartingWith(tree, "Fatura Inter").props.accessibilityLabel).toContain("R$ 70,00");
  });

  it("dá para trocar a fatura escolhida antes de importar", async () => {
    const cards = await seedCard();
    const tree = await mount();
    mockPick.bytes = bytesOf(csv());
    await press(tree, "Importar fatura do Inter");
    const options = tree.root
      .findAllByType(TouchableOpacity)
      .filter((node) => node.props.accessibilityRole === "radio")
      .map((node) => ({ label: node.props.accessibilityLabel as string, selected: node.props.accessibilityState.selected as boolean }));
    expect(options).toHaveLength(3);
    expect(options.map((option) => option.selected)).toEqual([false, true, false]);

    await press(tree, options[2].label);
    const after = tree.root.findAllByType(TouchableOpacity).filter((node) => node.props.accessibilityRole === "radio");
    expect(after.map((node) => node.props.accessibilityState.selected)).toEqual([false, false, true]);
    await press(tree, "Importar 2 compras");

    const refs = new Set((await cards.getAllCardPurchases()).map((row) => row.invoice_ref));
    expect([...refs]).toEqual([expect.stringMatching(/^\d{4}-\d{2}$/)]);
    const chosen = options[2].label.replace("Fatura ", "");
    expect(textOf(tree)).toContain(chosen);
  });

  it("o mesmo arquivo de novo não tem nada novo: mostra as já lançadas e o botão fica desligado", async () => {
    await seedCard();
    const tree = await mount();
    mockPick.bytes = bytesOf(csv());
    await press(tree, "Importar fatura do Inter");
    await press(tree, "Importar 2 compras");

    await press(tree, "Importar fatura do Inter");

    expect(textOf(tree)).toContain("0 compras novas (R$ 0,00)");
    expect(textOf(tree)).toContain("2 já lançadas");
    expect(confirmButton(tree, "Nada novo para importar").props.disabled).toBe(true);
  });

  it("arquivo que não é fatura só avisa", async () => {
    const cards = await seedCard();
    const tree = await mount();
    mockPick.bytes = bytesOf("isso não é uma fatura");

    await press(tree, "Importar fatura do Inter");

    expect(textOf(tree)).not.toContain("Importar fatura do Inter |");
    expect(textOf(tree)).toContain("Não consegui identificar");
    expect(await cards.getAllCardPurchases()).toEqual([]);
  });

  it("desistir do seletor não abre nada", async () => {
    await seedCard();
    const tree = await mount();

    await press(tree, "Importar fatura do Inter");

    expect(textOf(tree)).not.toContain("compras novas");
  });
});
