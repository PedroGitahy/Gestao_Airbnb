import postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

declare global {
  // eslint-disable-next-line no-var
  var __sql: Sql | undefined;
}

/** Conexão única com o PostgreSQL (reaproveitada entre requisições). */
export function db(): Sql {
  if (!globalThis.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não configurada");
    globalThis.__sql = postgres(url, {
      max: 10,
      idle_timeout: 30,
      onnotice: () => {},
      types: {
        // DATE chega como texto YYYY-MM-DD, sem conversão de fuso
        date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
      },
      transform: { undefined: null },
    });
  }
  return globalThis.__sql;
}
