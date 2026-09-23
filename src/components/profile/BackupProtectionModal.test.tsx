import React from "react";
import { ActivityIndicator, Switch, Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { BackupProtectionModal } from "./BackupProtectionModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
});

const flat = (node: unknown): string => [node].flat(Infinity).join("");
const textOf = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(RNText)
    .map((node) => flat(node.props.children))
    .join(" | ");

function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType(TouchableOpacity)
    .find((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));
  if (!found) throw new Error(`botão "${label}" não encontrado`);
  return found;
}

const hasButton = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAllByType(TouchableOpacity)
    .some((node) => node.findAllByType(RNText).some((t) => flat(t.props.children) === label));

const field = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(TextInput).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`campo "${label}" não encontrado`);
  return found;
};

const toggle = (tree: ReactTestRenderer, label: string) => {
  const found = tree.root.findAllByType(Switch).find((node) => node.props.accessibilityLabel === label);
  if (!found) throw new Error(`interruptor "${label}" não encontrado`);
  return found;
};

type ProtectionProps = React.ComponentProps<typeof BackupProtectionModal>;

function mountProtection(over: Partial<ProtectionProps> = {}) {
  const props: ProtectionProps = {
    visible: true,
    status: "off",
    isBusy: false,
    error: null,
    onClose: jest.fn(),
    onEnable: jest.fn(async () => true),
    onDisable: jest.fn(async () => true),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<BackupProtectionModal {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
}

const PASSWORD_LABEL = "Senha (mínimo 8 caracteres)";

describe("Proteger backups com senha: desligada", () => {
  it("explica, avisa que esquecer a senha perde os backups e mostra os campos", () => {
    const { tree } = mountProtection();
    const text = textOf(tree);

    expect(text).toContain("Proteger backups com senha");
    expect(text).toContain("saiam criptografados");
    expect(text).toContain("Guarde a senha fora do celular");
    expect(text).toContain("NÃO existe como recuperar os backups protegidos");
    expect(text).toContain("leva alguns segundos");
    expect(field(tree, PASSWORD_LABEL).props.secureTextEntry).toBe(true);
    expect(field(tree, "Repita a senha").props.secureTextEntry).toBe(true);
    expect(hasButton(tree, "Ativar proteção")).toBe(true);
  });

  it("'Mostrar a senha' revela os dois campos", () => {
    const { tree } = mountProtection();

    act(() => toggle(tree, "Mostrar a senha").props.onValueChange(true));

    expect(field(tree, PASSWORD_LABEL).props.secureTextEntry).toBe(false);
    expect(field(tree, "Repita a senha").props.secureTextEntry).toBe(false);
  });

  it("ativar entrega a senha e a confirmação digitadas e limpa os campos ao dar certo", async () => {
    const { tree, props } = mountProtection();
    act(() => field(tree, PASSWORD_LABEL).props.onChangeText("uma frase longa"));
    act(() => field(tree, "Repita a senha").props.onChangeText("uma frase longa"));

    await act(async () => {
      await button(tree, "Ativar proteção").props.onPress();
    });

    expect(props.onEnable).toHaveBeenCalledWith("uma frase longa", "uma frase longa");
    expect(field(tree, PASSWORD_LABEL).props.value).toBe("");
    expect(field(tree, "Repita a senha").props.value).toBe("");
  });

  it("se não deu certo, mantém o que foi digitado e mostra o erro", async () => {
    const { tree } = mountProtection({ onEnable: jest.fn(async () => false), error: "As duas senhas não são iguais." });
    act(() => field(tree, PASSWORD_LABEL).props.onChangeText("uma frase longa"));

    await act(async () => {
      await button(tree, "Ativar proteção").props.onPress();
    });

    expect(field(tree, PASSWORD_LABEL).props.value).toBe("uma frase longa");
    expect(textOf(tree)).toContain("As duas senhas não são iguais.");
  });

  it("gerando a chave: mostra o aviso, tira o botão e trava os campos", () => {
    const { tree } = mountProtection({ isBusy: true });

    expect(textOf(tree)).toContain("Gerando a chave…");
    expect(hasButton(tree, "Ativar proteção")).toBe(false);
    expect(field(tree, PASSWORD_LABEL).props.editable).toBe(false);
    expect(tree.root.findAllByType(ActivityIndicator).length).toBeGreaterThan(0);
    expect(button(tree, "Fechar").props.disabled).toBe(true);
  });

  it("fechar limpa a senha e avisa", () => {
    const { tree, props } = mountProtection();
    act(() => field(tree, PASSWORD_LABEL).props.onChangeText("uma frase longa"));

    act(() => button(tree, "Fechar").props.onPress());

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(field(tree, PASSWORD_LABEL).props.value).toBe("");
  });

  it("ainda lendo o estado: só o indicador, sem formulário", () => {
    const { tree } = mountProtection({ status: null });

    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
    expect(hasButton(tree, "Ativar proteção")).toBe(false);
  });
});

describe("Proteger backups com senha: ligada", () => {
  it("mostra que está ligada e oferece trocar a senha e desativar, sem formulário", () => {
    const { tree } = mountProtection({ status: "on" });
    const text = textOf(tree);

    expect(text).toContain("Proteção ligada");
    expect(text).toContain("continua sem pedir a senha");
    expect(hasButton(tree, "Trocar senha")).toBe(true);
    expect(hasButton(tree, "Desativar proteção")).toBe(true);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("trocar a senha abre o formulário e avisa que os backups antigos ficam com a senha antiga", async () => {
    const { tree, props } = mountProtection({ status: "on" });

    act(() => button(tree, "Trocar senha").props.onPress());
    expect(textOf(tree)).toContain("continuam com a senha antiga: guarde as duas");
    act(() => field(tree, PASSWORD_LABEL).props.onChangeText("outra frase longa"));
    act(() => field(tree, "Repita a senha").props.onChangeText("outra frase longa"));
    await act(async () => {
      await button(tree, "Salvar nova senha").props.onPress();
    });

    expect(props.onEnable).toHaveBeenCalledWith("outra frase longa", "outra frase longa");
    // Voltou para a tela de "ligada".
    expect(hasButton(tree, "Trocar senha")).toBe(true);
    expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  });

  it("cancelar a troca volta sem mudar nada", () => {
    const { tree, props } = mountProtection({ status: "on" });

    act(() => button(tree, "Trocar senha").props.onPress());
    act(() => button(tree, "Cancelar troca").props.onPress());

    expect(hasButton(tree, "Trocar senha")).toBe(true);
    expect(props.onEnable).not.toHaveBeenCalled();
  });

  it("desativar pede confirmação e explica o que acontece com os backups já feitos", async () => {
    const { tree, props } = mountProtection({ status: "on" });

    act(() => button(tree, "Desativar proteção").props.onPress());
    expect(textOf(tree)).toContain("Desativar a proteção?");
    expect(textOf(tree)).toContain("Os já feitos continuam protegidos e precisam da senha para abrir.");
    expect(props.onDisable).not.toHaveBeenCalled();

    await act(async () => {
      await button(tree, "Sim, desativar").props.onPress();
    });

    expect(props.onDisable).toHaveBeenCalledTimes(1);
  });

  it("'Voltar' na confirmação não desativa", () => {
    const { tree, props } = mountProtection({ status: "on" });

    act(() => button(tree, "Desativar proteção").props.onPress());
    act(() => button(tree, "Voltar").props.onPress());

    expect(props.onDisable).not.toHaveBeenCalled();
    expect(hasButton(tree, "Trocar senha")).toBe(true);
  });
});

describe("Proteger backups com senha: com problema", () => {
  it("explica que nenhum backup sai sem senha, deixa ativar de novo ou desativar", () => {
    const { tree } = mountProtection({ status: "broken" });
    const text = textOf(tree);

    expect(text).toContain("A proteção está com problema");
    expect(text).toContain("nenhum backup é gravado sem senha");
    expect(hasButton(tree, "Ativar proteção")).toBe(true);
    expect(hasButton(tree, "Desativar proteção")).toBe(true);
  });
});
