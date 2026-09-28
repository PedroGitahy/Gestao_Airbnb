import { ensureDatabase } from "./lib/schema";
import { syncAll } from "./lib/ical";
import { planMessages, processDueMessages } from "./lib/messages";

export async function start() {
  if (!process.env.DATABASE_URL) return; // durante o build não há banco
  try {
    await ensureDatabase();
  } catch (e) {
    console.error("[rgr] falha ao preparar o banco:", e);
    return;
  }

  const minutes = Math.max(5, Number(process.env.ICAL_SYNC_MINUTES || 30));
  const sync = () =>
    syncAll()
      .then((r) => {
        if (!r.skipped && r.feeds) console.log(`[rgr] iCal: ${r.feeds} calendários, ${r.errors} com erro`);
      })
      .catch((e) => console.error("[rgr] iCal:", e));

  let busy = false;
  const messages = async () => {
    if (busy) return;
    busy = true;
    try {
      await planMessages();
      const n = await processDueMessages();
      if (n) console.log(`[rgr] mensagens processadas: ${n}`);
    } catch (e) {
      console.error("[rgr] mensagens:", e);
    } finally {
      busy = false;
    }
  };

  setTimeout(sync, 15_000);
  setInterval(sync, minutes * 60_000);
  setTimeout(messages, 30_000);
  setInterval(messages, 5 * 60_000);
}
