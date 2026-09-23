# Meu Financeiro

[![CI](https://github.com/Guilherme-demetino/Finance-App/actions/workflows/ci.yml/badge.svg)](https://github.com/Guilherme-demetino/Finance-App/actions/workflows/ci.yml)

App de finanças pessoais para Android, feito com [Expo](https://expo.dev). Tudo roda no aparelho — o banco é local (SQLite), sem servidor, sem conta e sem sincronização na nuvem além do backup que você mesmo escolhe salvar.

## Funcionalidades

- **Transações**: receitas e despesas com categoria, conta, recorrência mensal e parcelamento. Escaneie um recibo pela câmera (OCR no aparelho, sem internet) para preencher o formulário sozinho.
- **Múltiplas contas/carteiras**: saldo separado por conta, seletor global no topo do painel e transferência entre contas.
- **Orçamento**: meta por categoria (com opção de repetir todo mês), alerta quando bate 80%/100%, comparação com o mês anterior e projeção de fechamento do mês.
- **Cartões de crédito**: compras parceladas, faturas calculadas automaticamente, importação de fatura em PDF/CSV com dedupe.
- **Dívidas e empréstimos**: quem te deve e a quem você deve, com data de vencimento.
- **Assinaturas recorrentes**: controle do que você paga todo mês/ano, com alerta de reajuste comparando com a cobrança real.
- **Metas de economia**: ritmo atual, projeção de quando a meta é atingida.
- **Histórico**: busca, filtros avançados (categoria, conta, tipo, período) e ordenação.
- **Lixeira**: excluir uma transação por engano tem volta — 30 dias para desfazer ou restaurar.
- **Lembretes de vencimento**: notificação local antes de contas, parcelas e faturas vencerem.
- **Widgets de tela inicial** (Android): saldo do mês e próximas contas a vencer, direto na home.
- **Backup**: exportação/importação completa dos dados, com opção de proteger por senha (XChaCha20-Poly1305 + scrypt).
- **Segurança**: bloqueio por PIN/biometria depois de um tempo em segundo plano.
- **Tema**: claro, escuro e alto contraste, com escala de fonte ajustável.

## Stack técnica

- [Expo SDK 57](https://docs.expo.dev/) + [expo-router](https://docs.expo.dev/router/introduction/) (navegação por arquivos)
- React 19 com o [React Compiler](https://react.dev/learn/react-compiler) ativado
- TypeScript em modo estrito
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) como banco local
- [Jest](https://jestjs.io/) + `react-test-renderer` para testes (sem E2E — ver `AGENTS.md`)
- [EAS Build](https://docs.expo.dev/build/introduction/) e [EAS Update](https://docs.expo.dev/eas-update/introduction/) para gerar o APK e publicar atualizações OTA

## Estrutura do projeto

```
src/
  app/          rotas (expo-router) — telas e navegação
  components/   componentes de UI, agrupados por domínio (transactions, overview, forms, profile, onboarding...)
  context/      estado global em React Context (por período, contas, transações, dívidas...)
  hooks/        hooks reutilizáveis por cima do context/database
  database/     acesso direto ao SQLite (uma função por tabela/consulta)
  services/     orquestração com efeitos colaterais (notificações, backup, widgets) — a peça "Deps" real
  utils/        lógica pura, sem I/O — o grosso da cobertura de testes vive aqui
  widgets/      widgets de tela inicial do Android (rodam fora da árvore React)
  theme/        cores, tipografia e o hook useTheme()
  constants/    categorias padrão, changelog do app
  integration/  testes de fluxo ponta a ponta (várias telas/contexts juntos)
```

Camadas: `utils/` (puro) → `database/` (SQLite) → `context/` (estado React) → `hooks/` → `components/`/`app/`. Um serviço com efeito colateral (notificação, widget, backup) separa a lógica pura (`utils/`) da parte "real" (`services/xDeps.ts`), para poder testar a lógica sem mockar o mundo inteiro.

## Como rodar localmente

```bash
npm install
npx expo start
```

> Alguns recursos (OCR de recibo, widgets de tela inicial) usam módulos nativos e **não funcionam no Expo Go** — é preciso um development build (`npx expo run:android` ou um build de desenvolvimento via EAS).

## Scripts disponíveis

| Comando               | O que faz                                   |
| ---------------------- | -------------------------------------------- |
| `npm run start`         | Inicia o Metro bundler                       |
| `npm run android`       | Abre no Android (emulador ou aparelho)       |
| `npm run test`          | Roda a suíte de testes (Jest)                |
| `npm run test:watch`    | Testes em modo observador                    |
| `npm run lint`          | ESLint (`expo lint`)                         |
| `npm run typegen`       | Gera os tipos das rotas do expo-router       |

Antes de qualquer commit: `npx tsc --noEmit`, `npx expo lint` e `npx jest` precisam passar limpos.

## Publicação

- **Mudança só de JS/React** (a maioria): `eas update` publica por cima do app já instalado (OTA), sem precisar de um APK novo.
- **Mudança nativa** (módulo novo, permissão, config plugin): precisa de `eas build` e um APK novo, porque o `runtimeVersion` do app segue a versão (`app.json`). Publicado como [Release no GitHub](https://github.com/Guilherme-demetino/Finance-App/releases) com o `.apk` anexado — o cartão "Nova versão do aplicativo" no Início busca a última release automaticamente.
- Toda atualização visível ganha uma entrada em [`src/constants/changelog.json`](src/constants/changelog.json), mostrada num pop-up e na tela "Atualizações".
