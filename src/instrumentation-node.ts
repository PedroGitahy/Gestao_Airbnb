import { ensureDatabase } from "./lib/schema";
import { syncAll } from "./lib/ical";

export async function start() {
  if (!process.env.DATABASE_URL) return; // durante o build não há banco
  try {
    await ensureDatabase();
  } catch (e) {
    console.error("[rgr] falha ao preparar o banco:", e);
    return;
  }
  const minutes = Math.max(5, Number(process.env.ICAL_SYNC_MINUTES || 30));
  const tick = () =>
    syncAll()
      .then((r) => {
        if (!r.skipped && r.feeds) console.log(`[rgr] iCal: ${r.feeds} calendários, ${r.errors} com erro`);
      })
      .catch((e) => console.error("[rgr] iCal:", e));
  setTimeout(tick, 15_000);
  setInterval(tick, minutes * 60_000);
}
