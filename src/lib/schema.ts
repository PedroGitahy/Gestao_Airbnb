import bcrypt from "bcryptjs";
import { db } from "./db";

/**
 * Migrações idempotentes. Cada versão roda uma única vez, em ordem.
 * Para mudar o banco depois, acrescente uma nova versão no fim da lista.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
CREATE TABLE users (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','atendimento','governanca','camareira')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE units (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,
  apt text,
  floor text,
  area numeric(6,2),
  capacity int NOT NULL DEFAULT 2,
  wifi_network text,
  wifi_password text,
  lock_id text,
  ical_airbnb text,
  ical_booking text,
  condo_fee numeric(10,2) NOT NULL DEFAULT 0,
  iptu numeric(10,2) NOT NULL DEFAULT 0,
  internet numeric(10,2) NOT NULL DEFAULT 0,
  guide_token text NOT NULL UNIQUE,
  ical_token text NOT NULL UNIQUE,
  notes text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE reservations (
  id serial PRIMARY KEY,
  unit_id int NOT NULL REFERENCES units(id),
  channel text NOT NULL CHECK (channel IN ('airbnb','booking','direto')),
  kind text NOT NULL DEFAULT 'reserva' CHECK (kind IN ('reserva','bloqueio')),
  external_uid text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ical')),
  guest_name text,
  guest_phone text,
  guest_email text,
  guests_count int,
  check_in date NOT NULL,
  check_out date NOT NULL,
  gross numeric(10,2),
  platform_fee_pct numeric(5,4),
  cleaning_fee numeric(10,2),
  status text NOT NULL DEFAULT 'confirmada' CHECK (status IN ('confirmada','cancelada')),
  rating numeric(2,1),
  portaria_ok boolean NOT NULL DEFAULT false,
  external_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
CREATE UNIQUE INDEX reservations_ext ON reservations(unit_id, channel, external_uid) WHERE external_uid IS NOT NULL;
CREATE INDEX reservations_dates ON reservations(check_in, check_out);

CREATE TABLE cleanings (
  id serial PRIMARY KEY,
  unit_id int NOT NULL REFERENCES units(id),
  reservation_id int REFERENCES reservations(id) ON DELETE SET NULL,
  date date NOT NULL,
  type text NOT NULL CHECK (type IN ('saida','saida_entrada','meio_estadia','profunda')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','pronta','vistoriada','cancelada')),
  assignee_id int REFERENCES users(id),
  checked_by int REFERENCES users(id),
  notes text,
  auto boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cleanings_auto ON cleanings(reservation_id) WHERE auto;
CREATE INDEX cleanings_date ON cleanings(date);

CREATE TABLE tickets (
  id serial PRIMARY KEY,
  unit_id int REFERENCES units(id),
  priority text NOT NULL CHECK (priority IN ('p1','p2','p3','preventiva')),
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_andamento','resolvida')),
  assignee text,
  opened_by int REFERENCES users(id),
  opened_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  resolved_at timestamptz,
  cost numeric(10,2)
);

CREATE TABLE expenses (
  id serial PRIMARY KEY,
  date date NOT NULL,
  unit_id int REFERENCES units(id),
  category text NOT NULL,
  description text,
  supplier text,
  amount numeric(10,2) NOT NULL,
  created_by int REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date ON expenses(date);

CREATE TABLE leads (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text,
  phone text,
  check_in date,
  check_out date,
  guests int,
  reason text,
  message text,
  status text NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','respondido','fechado','perdido')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT ''
);

CREATE TABLE sync_log (
  id serial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  unit_id int REFERENCES units(id),
  channel text,
  ok boolean NOT NULL,
  message text,
  events int NOT NULL DEFAULT 0
);
CREATE INDEX sync_log_ran ON sync_log(ran_at DESC);
`,
  },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: "RGR",
  airbnb_fee: "0.155",
  booking_fee: "0.15",
  airbnb_url: "",
  booking_url: "",
  whatsapp_central: "",
  phone_portaria: "",
  phone_plantao: "",
  email_contato: "",
  checkin_time: "15h",
  checkout_time: "11h",
  occupancy_goal: "0.70",
  rating_goal: "4.8",
  trash_location: "",
};

let ready: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!ready) {
    ready = run().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

function token() {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  for (const b of bytes) s += abc[b % abc.length];
  return s;
}

async function run() {
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (version int PRIMARY KEY, ran_at timestamptz NOT NULL DEFAULT now())`;
  // trava para duas instâncias não migrarem ao mesmo tempo
  await sql.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(424242)`;
    const done = new Set((await tx`SELECT version FROM schema_migrations`).map((r) => r.version as number));
    for (const m of MIGRATIONS) {
      if (done.has(m.version)) continue;
      await tx.unsafe(m.sql);
      await tx`INSERT INTO schema_migrations (version) VALUES (${m.version})`;
    }

    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
      await tx`INSERT INTO settings (key, value) VALUES (${k}, ${v}) ON CONFLICT (key) DO NOTHING`;
    }

    const [{ n }] = await tx`SELECT count(*)::int AS n FROM units`;
    if (n === 0) {
      for (let i = 1; i <= 20; i++) {
        const code = `U${String(i).padStart(2, "0")}`;
        await tx`INSERT INTO units (code, guide_token, ical_token) VALUES (${code}, ${token()}, ${token()})`;
      }
    }

    const [{ u }] = await tx`SELECT count(*)::int AS u FROM users`;
    if (u === 0) {
      const email = (process.env.ADMIN_EMAIL || "admin@rgr-ia.com").toLowerCase();
      const pass = process.env.ADMIN_PASSWORD || "trocar-agora";
      const hash = await bcrypt.hash(pass, 10);
      await tx`INSERT INTO users (name, email, password_hash, role) VALUES ('Administrador', ${email}, ${hash}, 'admin')`;
    }
  });
}
