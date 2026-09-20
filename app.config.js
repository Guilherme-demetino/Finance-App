// Estende o app.json (que chega aqui como `config`) sem alterar nenhum campo dele.
//
// Embute as últimas novidades do changelog em `extra.releaseNotes`. O
// EAS Update guarda a configuração do app no manifesto de cada atualização
// publicada, então o aparelho consegue ler "o que mudou" de uma atualização
// nova antes de baixá-la (tela "Atualizações"). Lido na hora do `eas update`,
// a partir do changelog.json da pasta de trabalho.
const changelog = require("./src/constants/changelog.json");

// Quantas novidades viajam no manifesto: cobre quem ficou algumas atualizações sem abrir o app.
const RELEASE_NOTES_IN_MANIFEST = 6;

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    releaseNotes: changelog.slice(-RELEASE_NOTES_IN_MANIFEST),
  },
});
