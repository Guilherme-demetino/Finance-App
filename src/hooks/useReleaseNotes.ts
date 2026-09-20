import { useCallback, useEffect, useState } from "react";
import { CHANGELOG, type Release } from "../constants/changelog";
import { getMeta, setMeta } from "../database/appMeta";
import { getUnseenReleases, parseLastSeenId } from "../utils/updates/releaseNotes";
import { logError } from "../utils/logger";

const LAST_SEEN_KEY = "last_seen_release";

const LATEST_RELEASE_ID = Math.max(0, ...CHANGELOG.map((release) => release.id));

/** Marca a novidade mais recente como vista, sem mostrar o pop-up (ex: instalação nova). */
export async function markReleaseNotesSeen(): Promise<void> {
  await setMeta(LAST_SEEN_KEY, String(LATEST_RELEASE_ID));
}

/**
 * Ao abrir o dashboard, devolve as novidades que o usuário ainda não viu.
 * Só marca como vistas quando ele fecha o pop-up, pra não perder o aviso se
 * o app for fechado com ele aberto.
 */
export function useReleaseNotes() {
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    let cancelled = false;

    getMeta(LAST_SEEN_KEY)
      .then((raw) => {
        if (cancelled) return;
        setReleases(getUnseenReleases(CHANGELOG, parseLastSeenId(raw)));
      })
      .catch((error) => {
        logError("Erro ao ler novidades da atualização:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => {
    setReleases([]);
    markReleaseNotesSeen().catch((error) => {
      logError("Erro ao salvar novidades vistas:", error);
    });
  }, []);

  return { releases, dismiss };
}
