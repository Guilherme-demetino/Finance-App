import React from "react";
import { Modal, Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { ProfileMenuModal } from "./ProfileMenuModals";

jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

type Props = React.ComponentProps<typeof ProfileMenuModal>;

function mountMenu(over: Partial<Props> = {}) {
  const props: Props = {
    visible: true,
    onClose: jest.fn(),
    userName: "Ana",
    userImage: null,
    onPickImage: jest.fn(),
    onOpenEditName: jest.fn(),
    onExportPDF: jest.fn(),
    onExportCSV: jest.fn(),
    onImportFile: jest.fn(),
    onExportBackup: jest.fn(),
    onRestoreBackup: jest.fn(),
    onOpenAutoBackup: jest.fn(),
    onOpenBackupProtection: jest.fn(),
    onOpenUpdates: jest.fn(),
    onOpenAppearance: jest.fn(),
    onOpenReminders: jest.fn(),
    onChangePIN: jest.fn(),
    onOpenTrash: jest.fn(),
    onOpenAccounts: jest.fn(),
    onWipeData: jest.fn(),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ProfileMenuModal {...props} />);
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

/** O botão mais interno com esse texto (o fundo e o cartão também "contêm" todos os textos do menu). */
function item(tree: ReactTestRenderer, label: string) {
  const matches = tree.root
    .findAllByType(TouchableOpacity)
    .filter((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (matches.length === 0) throw new Error(`item "${label}" não encontrado`);
  return matches[matches.length - 1];
}

describe("menu do perfil", () => {
  it("o botão Voltar fica na linha do topo, no canto direito, oposto ao da foto", () => {
    const { tree } = mountMenu();
    const back = tree.root.findAllByType(TouchableOpacity).find((node) => node.props.accessibilityLabel === "Voltar");

    expect(back).toBeDefined();
    expect(back?.props.accessibilityRole).toBe("button");

    // Mesma linha da foto: a foto é a primeira coisa dela e o Voltar, a última.
    const row = back!.parent!;
    const children = row.children;
    expect(children).toHaveLength(3);
    expect(children[0]).toBe(row.findAllByType(TouchableOpacity)[0]); // a foto
    expect(children[children.length - 1]).toBe(back);
    expect(row.findAllByType(RNText).map((node) => flat(node.props.children))).toEqual(["Ana", "Editar Nome", "Voltar"]);

    // Continua acima das opções.
    expect(textOf(tree).indexOf("Voltar")).toBeLessThan(textOf(tree).indexOf("Exportar Relatório PDF"));
  });

  it("Voltar fecha o menu sem disparar nenhuma opção", () => {
    const { tree, props } = mountMenu();

    const back = item(tree, "Voltar");
    expect(back.props.accessibilityLabel).toBe("Voltar");
    act(() => back.props.onPress());

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onExportPDF).not.toHaveBeenCalled();
    expect(props.onWipeData).not.toHaveBeenCalled();
  });

  it("o botão voltar do Android também fecha o menu", () => {
    const { tree, props } = mountMenu();

    act(() => tree.root.findByType(Modal).props.onRequestClose());

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("tocar fora do cartão continua fechando", () => {
    const { tree, props } = mountMenu();
    const overlay = tree.root.findAllByType(TouchableOpacity)[0];

    act(() => overlay.props.onPress());

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("as opções continuam chamando cada ação", () => {
    const { tree, props } = mountMenu();

    act(() => item(tree, "Lembretes e Alertas").props.onPress());
    act(() => item(tree, "Proteger Backups com Senha").props.onPress());
    act(() => item(tree, "Atualizações do App").props.onPress());
    act(() => item(tree, "Contas").props.onPress());
    act(() => item(tree, "Lixeira").props.onPress());
    act(() => item(tree, "Zerar Dados do App").props.onPress());

    expect(props.onOpenReminders).toHaveBeenCalledTimes(1);
    expect(props.onOpenBackupProtection).toHaveBeenCalledTimes(1);
    expect(props.onOpenUpdates).toHaveBeenCalledTimes(1);
    expect(props.onOpenAccounts).toHaveBeenCalledTimes(1);
    expect(props.onOpenTrash).toHaveBeenCalledTimes(1);
    expect(props.onWipeData).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it("fechado, não desenha nada", () => {
    const { tree } = mountMenu({ visible: false });

    expect(tree.toJSON()).toBeNull();
  });
});
