import React from "react";
import { Switch, Text as RNText, TextInput, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { RestorePasswordModal } from "./RestorePasswordModal";

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

type RestoreProps = React.ComponentProps<typeof RestorePasswordModal>;

function mountRestore(over: Partial<RestoreProps> = {}) {
  const props: RestoreProps = {
    visible: true,
    isBusy: false,
    error: null,
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    ...over,
  };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<RestorePasswordModal {...props} />);
  });
  mounted.push(tree);
  return { tree, props };
}

describe("Senha para restaurar", () => {
  it("pede a senha, oculta o que se digita e já vem marcado para continuar protegendo", () => {
    const { tree } = mountRestore();

    expect(textOf(tree)).toContain("Backup protegido");
    expect(textOf(tree)).toContain("Digite a senha usada para proteger este backup.");
    expect(textOf(tree)).toContain("leva alguns segundos");
    expect(field(tree, "Senha do backup").props.secureTextEntry).toBe(true);
    expect(toggle(tree, "Continuar protegendo meus backups com esta senha").props.value).toBe(true);
  });

  it("sem senha digitada, não dá para abrir", () => {
    const { tree, props } = mountRestore();

    expect(button(tree, "Abrir backup").props.disabled).toBe(true);
    act(() => button(tree, "Abrir backup").props.onPress());
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("abrir entrega a senha e a escolha de continuar protegendo; a senha some do campo", () => {
    const { tree, props } = mountRestore();
    act(() => field(tree, "Senha do backup").props.onChangeText("minha frase de senha"));
    act(() => toggle(tree, "Continuar protegendo meus backups com esta senha").props.onValueChange(false));

    act(() => button(tree, "Abrir backup").props.onPress());

    expect(props.onSubmit).toHaveBeenCalledWith("minha frase de senha", false);
    expect(field(tree, "Senha do backup").props.value).toBe("");
  });

  it("senha errada: mostra o erro e deixa tentar de novo", () => {
    const { tree } = mountRestore({ error: "Senha incorreta ou arquivo alterado." });

    expect(textOf(tree)).toContain("Senha incorreta ou arquivo alterado.");
    expect(hasButton(tree, "Abrir backup")).toBe(true);
  });

  it("abrindo: mostra o aviso, tira o botão e trava o cancelar", () => {
    const { tree } = mountRestore({ isBusy: true });

    expect(textOf(tree)).toContain("Abrindo o backup…");
    expect(hasButton(tree, "Abrir backup")).toBe(false);
    expect(button(tree, "Cancelar").props.disabled).toBe(true);
    expect(field(tree, "Senha do backup").props.editable).toBe(false);
  });

  it("cancelar avisa e limpa a senha", () => {
    const { tree, props } = mountRestore();
    act(() => field(tree, "Senha do backup").props.onChangeText("minha frase de senha"));

    act(() => button(tree, "Cancelar").props.onPress());

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(field(tree, "Senha do backup").props.value).toBe("");
  });
});
