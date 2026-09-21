/**
 * O react-native-reanimated de mentira dos testes de tela: as animações de entrada viram nada e o
 * `Animated.View`/`ScrollView` são os do React Native. Uso:
 *
 *   jest.mock("react-native-reanimated", () => jest.requireActual("../test/reanimatedMock").createReanimatedMock());
 */
export function createReanimatedMock() {
  const RN = jest.requireActual("react-native");
  const chain = () => {
    const animation: Record<string, () => unknown> = {};
    for (const method of ["duration", "delay", "springify", "damping"]) animation[method] = () => animation;
    return animation;
  };
  return {
    __esModule: true,
    default: { View: RN.View, ScrollView: RN.ScrollView },
    FadeIn: chain(),
    FadeInDown: chain(),
    useAnimatedScrollHandler: () => () => {},
    useSharedValue: (initial: number) => {
      const { useRef } = jest.requireActual<typeof import("react")>("react");
      return useRef({ value: initial, get: () => initial, set: () => {} }).current;
    },
  };
}
