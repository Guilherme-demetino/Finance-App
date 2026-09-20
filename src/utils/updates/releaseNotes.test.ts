import type { Release } from "../../constants/changelog";
import { getUnseenReleases, parseLastSeenId } from "./releaseNotes";

const release = (id: number): Release => ({
  id,
  date: "01/01/2026",
  title: `Versão ${id}`,
  items: ["Algo mudou"],
});

describe("getUnseenReleases", () => {
  const changelog = [release(1), release(2), release(3)];

  it("mostra tudo para quem nunca viu nenhuma, da mais nova pra mais antiga", () => {
    expect(getUnseenReleases(changelog, null).map((r) => r.id)).toEqual([3, 2, 1]);
  });

  it("mostra só o que veio depois da última vista", () => {
    expect(getUnseenReleases(changelog, 1).map((r) => r.id)).toEqual([3, 2]);
  });

  it("não mostra nada quando já viu a mais nova", () => {
    expect(getUnseenReleases(changelog, 3)).toEqual([]);
  });

  it("limita a quantidade listada", () => {
    const many = Array.from({ length: 8 }, (_, i) => release(i + 1));
    expect(getUnseenReleases(many, null).map((r) => r.id)).toEqual([8, 7, 6, 5, 4]);
  });
});

describe("parseLastSeenId", () => {
  it("lê números e trata o resto como nunca visto", () => {
    expect(parseLastSeenId("4")).toBe(4);
    expect(parseLastSeenId(null)).toBeNull();
    expect(parseLastSeenId("abc")).toBeNull();
    expect(parseLastSeenId("1.5")).toBeNull();
  });
});
