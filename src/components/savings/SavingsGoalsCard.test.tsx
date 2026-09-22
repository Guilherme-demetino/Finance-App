import React from "react";
import { Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import type { SavingsGoalRow } from "../../types";
import { SavingsGoalsCard } from "./SavingsGoalsCard";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

const goal = (over: Partial<SavingsGoalRow> = {}): SavingsGoalRow => ({
  id: 1,
  name: "Viagem",
  target_amount: 5000,
  saved_amount: 1000,
  deadline: null,
  created_date: "01/09/2026",
  start_amount: 0,
  ...over,
});

type Props = React.ComponentProps<typeof SavingsGoalsCard>;

function mount(goals: SavingsGoalRow[], over: Partial<Props> = {}) {
  const props: Props = {
    goals,
    isLoading: false,
    onOpenCreate: jest.fn(),
    onOpenDeposit: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<SavingsGoalsCard {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
}

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

const byLabel = (tree: ReactTestRenderer, label: string) => tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === label);

/** O botão mais interno com esse texto (o "Excluir" do confirmar). */
function byText(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (matches.length === 0) throw new Error(`botão "${label}" não encontrado`);
  return matches[matches.length - 1];
}

describe("cartão Metas de Economia", () => {
  it("cada meta tem o botão Editar, além de excluir e guardar/retirar", () => {
    const { tree } = mount([goal(), goal({ id: 2, name: "Carro" })]);

    expect(textOf(tree).match(/Editar/g)).toHaveLength(2);
    for (const name of ["Viagem", "Carro"]) {
      expect(byLabel(tree, `Editar meta ${name}`)?.props.accessibilityRole).toBe("button");
      expect(byLabel(tree, `Excluir meta ${name}`)).toBeDefined();
      expect(byLabel(tree, `Guardar ou retirar em ${name}`)).toBeDefined();
    }
  });

  it("Editar entrega a meta certa (não a primeira da lista)", () => {
    const first = goal();
    const second = goal({ id: 2, name: "Carro", target_amount: 30000 });
    const { tree, props } = mount([first, second]);

    act(() => byLabel(tree, "Editar meta Carro")?.props.onPress());

    expect(props.onEdit).toHaveBeenCalledTimes(1);
    expect(props.onEdit).toHaveBeenCalledWith(second);
    expect(props.onOpenDeposit).not.toHaveBeenCalled();
    expect(props.onDelete).not.toHaveBeenCalled();
  });

  it("guardar/retirar e criar continuam funcionando", () => {
    const first = goal();
    const { tree, props } = mount([first]);

    act(() => byLabel(tree, "Guardar ou retirar em Viagem")?.props.onPress());

    expect(props.onOpenDeposit).toHaveBeenCalledWith(first);
  });

  it("excluir continua pedindo confirmação antes de apagar", () => {
    const { tree, props } = mount([goal()]);

    act(() => byLabel(tree, "Excluir meta Viagem")?.props.onPress());
    expect(props.onDelete).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain('Excluir a meta "Viagem"?');

    act(() => byText(tree, "Excluir").props.onPress());

    expect(props.onDelete).toHaveBeenCalledWith(1);
  });

  it("mostra o progresso e o prazo da meta", () => {
    const { tree } = mount([goal({ deadline: "31/12/2030" })]);
    const text = textOf(tree);

    expect(text).toContain("R$ 1.000,00 de R$ 5.000,00");
    expect(text).toContain("20%");
    expect(text).toContain("Até 31/12/2030");
  });

  it("sem metas: convite para criar e nenhum botão de editar", () => {
    const { tree, props } = mount([]);

    expect(textOf(tree)).toContain("Nenhuma meta de economia");
    expect(textOf(tree)).not.toContain("Editar");
    act(() => byText(tree, "Nenhuma meta de economia").props.onPress());
    expect(props.onOpenCreate).toHaveBeenCalledTimes(1);
  });

  describe("ritmo e projeção", () => {
    // 01/03/2026: 59 dias depois da criação (01/01).
    const TODAY = new Date(2026, 2, 1);
    const started = (over: Partial<SavingsGoalRow> = {}) => goal({ created_date: "01/01/2026", ...over });
    const markLabels = (tree: ReactTestRenderer) =>
      tree.root
        .findAll((node) => typeof node.type === "string" && String(node.props.accessibilityLabel ?? "").startsWith("Esperado até hoje"))
        .map((node) => node.props.accessibilityLabel as string);

    it("mostra o ritmo e quando a meta será atingida, dentro do prazo", () => {
      const { tree } = mount([started({ deadline: "31/12/2026" })], { today: TODAY });

      expect(textOf(tree)).toMatch(/No ritmo atual \(R\$ 5\d\d,\d\d\/mês\) você chega lá em out\/2026, dentro do prazo\./);
    });

    it("avisa quando o ritmo atual passa do prazo", () => {
      const { tree } = mount([started({ deadline: "31/07/2026" })], { today: TODAY });

      expect(textOf(tree)).toMatch(/você chega lá em out\/2026, [23] meses depois do prazo\./);
    });

    it("põe na barra a marca de onde deveria estar hoje para chegar no prazo", () => {
      const { tree } = mount([started({ deadline: "31/12/2026" })], { today: TODAY });

      expect(markLabels(tree)).toEqual(["Esperado até hoje para chegar no prazo: 16%"]);
      expect(textOf(tree)).toContain("A marca na barra é onde você deveria estar hoje para chegar no prazo (16%).");
    });

    it("sem prazo: projeta, mas não há marca na barra", () => {
      const { tree } = mount([started()], { today: TODAY });

      expect(markLabels(tree)).toEqual([]);
      expect(textOf(tree)).toMatch(/você chega lá em out\/2026\./);
    });

    it("meta nova demais: explica que a projeção aparece depois de 14 dias", () => {
      const { tree } = mount([goal({ created_date: "25/02/2026" })], { today: TODAY });

      expect(textOf(tree)).toContain("A projeção aparece depois de 14 dias de meta (faltam 10 dias).");
    });

    it("sem depósitos desde a criação: convida a guardar", () => {
      const { tree } = mount([started({ saved_amount: 0 })], { today: TODAY });

      expect(textOf(tree)).toContain("Ainda sem depósitos");
    });

    it("meta alcançada não tem projeção nem marca", () => {
      const { tree } = mount([started({ saved_amount: 5000, deadline: "31/12/2026" })], { today: TODAY });

      expect(textOf(tree)).toContain("Meta alcançada");
      expect(textOf(tree)).not.toContain("No ritmo atual");
      expect(markLabels(tree)).toEqual([]);
    });

    it("com várias metas mostra o total guardado de todas juntas", () => {
      const { tree } = mount([started({ id: 1, saved_amount: 1000, target_amount: 5000 }), started({ id: 2, name: "Carro", saved_amount: 9000, target_amount: 10000 })], { today: TODAY });

      expect(textOf(tree)).toContain("Todas as metas: R$ 10.000,00 de R$ 15.000,00 (66%)");
    });

    it("com uma meta só, sem o resumo geral", () => {
      const { tree } = mount([started()], { today: TODAY });

      expect(textOf(tree)).not.toContain("Todas as metas");
    });
  });
});
