import React from "react";
import { act, create } from "react-test-renderer";

import { useStableCallback } from "./useStableCallback";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

describe("useStableCallback", () => {
  it("mantém a mesma função e chama sempre a versão mais recente", () => {
    const seen: ((n: number) => number)[] = [];

    const Probe = ({ factor }: { factor: number }) => {
      seen.push(useStableCallback((n: number) => n * factor));
      return null;
    };

    let root!: ReturnType<typeof create>;
    act(() => {
      root = create(<Probe factor={2} />);
    });
    act(() => root.update(<Probe factor={10} />));

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(new Set(seen).size).toBe(1);
    expect(seen[0](3)).toBe(30);
  });
});
