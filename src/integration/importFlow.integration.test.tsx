import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { useAlertState } from "../context/AlertContext";
import { DashboardProviders } from "../context/DashboardProviders";
import { useTransactionsData } from "../context/TransactionsContext";
import { readBackupData } from "../database/backup";
import { resetDatabase } from "../database/sqlite";
import { createTransaction, getAllTransactions, importTransactions } from "../database/transactions";
import { useDataTransfer } from "../hooks/useDataTransfer";
import { createSqlJsDatabase } from "../test/sqliteFake";
import { buildBackupFile, serializeBackup } from "../utils/backup/backup";
import { planPdfImport } from "../utils/statements/bankPdf";

/**
 * Integração: importar extrato e restaurar backup pelos mesmos handlers do menu
 * do perfil, com providers, hooks e banco de verdade. Só o seletor de arquivos
 * e os módulos nativos são trocados.
 */
const mockState: { db: unknown } = { db: null };
const mockPick: { bytes: Uint8Array | null } = { bytes: null };

/** UTF-8 sem depender de tipos do Node (Buffer). O nome começa com "mock" para poder ser usado no jest.mock. */
function mockDecodeUtf8(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return decodeURIComponent(escape(binary));
}

jest.mock("expo-sqlite", () => ({ openDatabaseSync: () => mockState.db }));
jest.mock("expo-file-system", () => {
  class File {
    static async pickFileAsync() {
      const bytes = mockPick.bytes;
      if (bytes === null) return { canceled: true, result: null };
      return {
        canceled: false,
        result: {
          arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          text: async () => mockDecodeUtf8(bytes),
        },
      };
    }
  }
  return { File, Paths: { cache: "cache" } };
});
jest.mock("expo-print", () => ({ printAsync: jest.fn() }));
jest.mock("expo-sharing", () => ({ isAvailableAsync: async () => false, shareAsync: jest.fn() }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: async () => null,
  setItemAsync: async () => {},
  deleteItemAsync: async () => {},
}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(),
  OrientationLock: { LANDSCAPE: 1, PORTRAIT_UP: 2 },
}));
jest.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: number) => {
    const { useRef } = jest.requireActual<typeof import("react")>("react");
    return useRef({ value: initial, get: () => initial, set: () => {} }).current;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

type Seen = {
  transfer: ReturnType<typeof useDataTransfer>;
  transactions: ReturnType<typeof useTransactionsData>;
  alert: ReturnType<typeof useAlertState>;
};

function createApp() {
  const seen = {} as Seen;
  const capture = (values: Seen) => Object.assign(seen, values);
  function Probe() {
    capture({
      transfer: useDataTransfer(),
      transactions: useTransactionsData(),
      alert: useAlertState(),
    });
    return null;
  }
  return { seen, Probe };
}

let seen: Seen;
let Probe: () => null;
const mounted: ReactTestRenderer[] = [];

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

async function mountApp() {
  await act(async () => {
    mounted.push(
      create(
        <DashboardProviders>
          <Probe />
        </DashboardProviders>,
      ),
    );
  });
  await settle();
}

const bytesOf = (text: string) => {
  const binary = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

/** Dia 0X do mês atual, para as transações importadas caírem no período que a tela mostra. */
const thisMonth = (day: number) => {
  const now = new Date();
  return `${String(day).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
};

const NUBANK_CSV = () =>
  [
    "Data,Valor,Identificador,Descrição",
    `${thisMonth(1)},-500.00,a1,Aplicação RDB`,
    `${thisMonth(2)},300.00,a2,Resgate RDB`,
    `${thisMonth(3)},1200.00,a3,Transferência recebida pelo Pix - Empresa`,
    `${thisMonth(4)},-20.00,a4,Compra no débito - Padaria`,
  ].join("\n");

/** Escolhe o arquivo e roda a importação até a tela de confirmação. */
async function pickForImport(bytes: Uint8Array | null) {
  mockPick.bytes = bytes;
  await act(async () => {
    await seen.transfer.handleImportFile();
  });
}

beforeAll(async () => {
  mockState.db = await createSqlJsDatabase();
});

beforeEach(async () => {
  await resetDatabase();
  mockPick.bytes = null;
  ({ seen, Probe } = createApp());
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((tree) => tree.unmount());
  });
  jest.restoreAllMocks();
});

describe("importar extrato (menu do perfil)", () => {
  it("lê o CSV, ignora caixinha, pede confirmação e só grava ao confirmar", async () => {
    await mountApp();

    await pickForImport(bytesOf(NUBANK_CSV()));

    expect(seen.transfer.pendingImport).not.toBeNull();
    expect(seen.transfer.pendingImport!.toImport).toHaveLength(2);
    expect(seen.transfer.pendingImport!.ignoredTransfers).toBe(2);
    expect(await getAllTransactions()).toHaveLength(0); // ainda nada gravado

    await act(async () => {
      await seen.transfer.confirmImport();
    });
    await settle();

    const stored = await getAllTransactions();
    expect(stored.map((t) => [t.description, t.type, t.category_id, t.amount]).sort()).toEqual([
      ["Compra no débito - Padaria", "expense", "Alimentação", 20],
      ["Transferência recebida pelo Pix - Empresa", "income", "Pix", 1200],
    ]);
    expect(seen.alert.alertMessage).toBe("2 transações importadas com sucesso.");
    // e a tela já reflete, sem reabrir o app
    expect(seen.transactions.totalIncome).toBe(1200);
    expect(seen.transactions.totalExpense).toBe(20);
    expect(seen.transfer.pendingImport).toBeNull();
  });

  it("importar o mesmo arquivo de novo não duplica", async () => {
    await mountApp();
    await pickForImport(bytesOf(NUBANK_CSV()));
    await act(async () => {
      await seen.transfer.confirmImport();
    });
    await settle();

    await pickForImport(bytesOf(NUBANK_CSV()));

    expect(seen.transfer.pendingImport).toBeNull();
    expect(seen.alert.alertTitle).toBe("Nada para importar");
    expect(seen.alert.alertMessage).toContain("já estão no app");
    expect(await getAllTransactions()).toHaveLength(2);
  });

  it("cancelar a confirmação não grava nada", async () => {
    await mountApp();
    await pickForImport(bytesOf(NUBANK_CSV()));

    act(() => seen.transfer.setPendingImport(null));

    expect(await getAllTransactions()).toHaveLength(0);
  });

  it("arquivo que não é extrato avisa e não grava nada", async () => {
    await mountApp();

    await pickForImport(bytesOf("isso não é um extrato de banco"));

    expect(seen.transfer.pendingImport).toBeNull();
    expect(seen.alert.alertTitle).toBe("Arquivo inválido");
    expect(await getAllTransactions()).toHaveLength(0);
  });

  it("desistir do seletor de arquivos não faz nada", async () => {
    await mountApp();

    await pickForImport(null);

    expect(seen.transfer.pendingImport).toBeNull();
    expect(seen.alert.alertVisible).toBe(false);
  });

  it("um backup completo escolhido aqui é encaminhado para 'Restaurar backup'", async () => {
    await mountApp();
    const backup = serializeBackup(buildBackupFile(await readBackupData(), new Date()));

    await pickForImport(bytesOf(backup));

    expect(seen.alert.alertTitle).toBe("Esse é um backup completo");
    expect(seen.alert.alertMessage).toContain("Restaurar backup");
  });
});

describe("extrato do Mercado Pago (linhas do PDF de teste) até o banco", () => {
  const LINES = [
    "Data Descricao ID da operacao Valor Saldo",
    "01/09/2026 Voce recebeu um Pix de Joao da Silva 88250398513 150,00 1.650,00",
    "02/09/2026 Pagamento de Maria Souza para voce 88250398777 45,90 1.695,90",
    "03/09/2026 Transferencia enviada via Pix 88250399012 -230,00 1.465,90",
    "04/09/2026 Pagamento de conta - Energia Eletrica 88250399555 -180,45 1.285,45",
    "05/09/2026 Recebimento de venda - Mercado Livre 88250399888 320,00 1.605,45",
    "06/09/2026 Tarifa de manutencao de conta 88250400111 -9,90 1.595,55",
    "07/09/2026 Voce recebeu um Pix de Ana Pereira 88250400222 75,00 1.670,55",
    "08/09/2026 Pagamento de boleto - Internet 88250400333 -99,90 1.570,65",
    "09/09/2026 Recebimento de venda - Loja Online 88250400444 540,00 2.110,65",
    "10/09/2026 Transferencia enviada via Pix 88250400555 -1.200,00 910,65",
  ];

  it("10 transações: 5 receitas e 5 despesas que fecham com o saldo do extrato", async () => {
    const first = planPdfImport(LINES, await getAllTransactions());
    if (!first.ok) throw new Error(first.error);
    expect(first.plan.toImport).toHaveLength(10);

    await importTransactions(first.plan.toImport);

    const stored = await getAllTransactions();
    const income = stored.filter((t) => t.type === "income");
    const expense = stored.filter((t) => t.type === "expense");
    const sum = (rows: typeof stored) => Math.round(rows.reduce((s, t) => s + t.amount, 0) * 100) / 100;
    expect([income.length, sum(income)]).toEqual([5, 1130.9]);
    expect([expense.length, sum(expense)]).toEqual([5, 1720.25]);
    // 1.500,00 de saldo inicial + entradas - saídas = saldo final do extrato
    expect(Math.round((1500 + sum(income) - sum(expense)) * 100) / 100).toBe(910.65);

    const again = planPdfImport(LINES, stored);
    if (!again.ok) throw new Error(again.error);
    expect(again.plan.toImport).toHaveLength(0);
    expect(again.plan.duplicates).toBe(10);
  });
});

describe("restaurar backup (menu do perfil)", () => {
  async function seedApp() {
    await createTransaction({
      amount: 100,
      date: thisMonth(1),
      description: "Do backup",
      type: "income",
      category: "Salário",
    });
    return serializeBackup(buildBackupFile(await readBackupData(), new Date()));
  }

  it("mostra backup x app agora e, ao confirmar, substitui tudo e recarrega a tela", async () => {
    const backup = await seedApp();
    await createTransaction({
      amount: 5,
      date: thisMonth(2),
      description: "Feita depois do backup",
      type: "expense",
      category: "Geral",
    });
    await mountApp();
    expect(seen.transactions.formattedTransactions).toHaveLength(2);

    mockPick.bytes = bytesOf(backup);
    await act(async () => {
      await seen.transfer.handleRestoreBackup();
    });

    expect(seen.transfer.pendingRestore).not.toBeNull();
    expect(seen.transfer.pendingRestore!.current.transactions).toBe(2);
    expect(seen.transfer.pendingRestore!.backup.data.transactions).toHaveLength(1);
    expect((await getAllTransactions()).length).toBe(2); // nada mudou ainda

    await act(async () => {
      await seen.transfer.confirmRestore();
    });
    await settle();

    expect((await getAllTransactions()).map((t) => t.description)).toEqual(["Do backup"]);
    expect(seen.transactions.formattedTransactions.map((t) => t.description)).toEqual(["Do backup"]);
    expect(seen.alert.alertMessage).toBe("Backup restaurado. Os dados do app foram substituídos.");
  });

  it("arquivo inválido é recusado sem mexer em nada", async () => {
    await seedApp();
    await mountApp();

    mockPick.bytes = bytesOf(JSON.stringify({ format: "meu-financeiro-backup", version: 1, createdAt: "2026-09-19T10:00:00.000Z", data: {} }));
    await act(async () => {
      await seen.transfer.handleRestoreBackup();
    });

    expect(seen.transfer.pendingRestore).toBeNull();
    expect(seen.alert.alertTitle).toBe("Backup inválido");
    expect((await getAllTransactions()).map((t) => t.description)).toEqual(["Do backup"]);
  });

  it("cancelar a confirmação mantém os dados atuais", async () => {
    const backup = await seedApp();
    await createTransaction({
      amount: 5,
      date: thisMonth(2),
      description: "Fica",
      type: "expense",
      category: "Geral",
    });
    await mountApp();

    mockPick.bytes = bytesOf(backup);
    await act(async () => {
      await seen.transfer.handleRestoreBackup();
    });
    act(() => seen.transfer.setPendingRestore(null));

    expect(await getAllTransactions()).toHaveLength(2);
  });
});
