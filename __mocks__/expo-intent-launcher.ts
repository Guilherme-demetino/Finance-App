// Os testes não têm o módulo nativo do Android: este faz-de-conta é usado no lugar do pacote.
export const startActivityAsync = jest.fn(async () => ({ resultCode: 0 }));
export const openApplication = jest.fn();
