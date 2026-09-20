import React from "react";
import { ActivityIndicator, Text as RNText, TouchableOpacity } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

import { createFakeApkDeps, githubRelease } from "../test/fakeApkUpdateDeps";
import { ApkUpdateCard } from "./ApkUpdateCard";

const mockFake: { current: ReturnType<typeof createFakeApkDeps> | null } = { current: null };

jest.mock("../services/apkUpdateDeps", () => ({
  realApkUpdateDeps: new Proxy(
    {},
    {
      get: (_target, key) => (mockFake.current?.deps as unknown as Record<string | symbol, unknown>)[key],
    },
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: ReactTestRenderer[] = [];

function mount(version = "1.0.0") {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<ApkUpdateCard currentVersion={version} />);
  });
  mounted.push(tree);
  return tree;
}

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

beforeEach(() => {
  mockFake.current = createFakeApkDeps();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    mounted.splice(0).forEach((t) => t.unmount());
  });
  jest.restoreAllMocks();
});

describe("cartão Nova versão do aplicativo", () => {
  it("explica para que serve e começa só com o botão de verificar", () => {
    const text = textOf(mount());

    expect(text).toContain("Nova versão do aplicativo");
    expect(text).toContain("instaladas por cima, mantendo seus dados");
    expect(text).toContain("Verificar nova versão do app");
    expect(text).not.toContain("disponível");
  });

  it("acha a versão nova e mostra tamanho, notas e o aviso da confirmação do Android", async () => {
    const tree = mount();

    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });
    const text = textOf(tree);

    expect(text).toContain("Nova versão 1.1.0 disponível");
    expect(text).toContain("Arquivo de 1 KB");
    expect(text).toContain("Lembretes de vencimento e atualização pelo app.");
    expect(text).toContain("prefira uma rede Wi-Fi");
    expect(text).toContain("O Android vai pedir a sua confirmação");
    expect(text).toContain("Baixar e instalar");
  });

  it("baixar e instalar abre o instalador; ao voltar sem instalar oferece Instalar e Baixar de novo", async () => {
    const tree = mount();
    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });

    await act(async () => {
      await button(tree, "Baixar e instalar").props.onPress();
    });

    expect(mockFake.current?.state.installed).toEqual(["content://app.fileprovider/cache/Finance-update.apk"]);
    const text = textOf(tree);
    expect(text).toContain("A instalação não foi concluída");
    expect(text).toContain("Instalar");
    expect(text).toContain("Baixar de novo");
  });

  it("durante o download mostra a porcentagem e o botão de cancelar", async () => {
    mockFake.current!.state.holdDownload = true;
    const tree = mount();
    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });

    await act(async () => {
      button(tree, "Baixar e instalar").props.onPress();
    });

    expect(textOf(tree)).toContain("Baixando a nova versão");
    expect(textOf(tree)).toContain("25%");
    expect(button(tree, "Verificar nova versão do app").props.disabled).toBe(true);

    await act(async () => {
      button(tree, "Cancelar download").props.onPress();
    });
    expect(textOf(tree)).toContain("Download cancelado.");
  });

  it("já atualizado: diz as duas versões", async () => {
    const tree = mount("1.1.0");

    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });

    expect(textOf(tree)).toContain("O aplicativo está na versão mais recente");
    expect(textOf(tree)).toContain("Instalada: 1.1.0. Publicada mais recente: 1.1.0.");
  });

  it("sem internet: erro e Tentar de novo", async () => {
    mockFake.current!.state.response = new TypeError("Network request failed");
    const tree = mount();

    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });
    expect(textOf(tree)).toContain("Sem conexão com a internet");

    mockFake.current!.state.response = { status: 200, json: githubRelease() };
    await act(async () => {
      await button(tree, "Tentar de novo").props.onPress();
    });
    expect(textOf(tree)).toContain("Nova versão 1.1.0 disponível");
  });

  it("erro na instalação oferece abrir a página da versão", async () => {
    mockFake.current!.state.installError = new Error("Activity not found");
    const tree = mount();
    await act(async () => {
      await button(tree, "Verificar nova versão do app").props.onPress();
    });
    await act(async () => {
      await button(tree, "Baixar e instalar").props.onPress();
    });

    expect(textOf(tree)).toContain("Não foi possível abrir o instalador do Android");
    expect(button(tree, "Abrir a página da versão")).toBeTruthy();
    expect(tree.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  });
});
