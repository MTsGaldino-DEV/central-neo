/**
 * Aplica as migrations de supabase/migrations no banco central-neo (NEO_DATABASE_URL do .env).
 * Cada arquivo roda numa transação e fica registrado em neo_interno.migracoes.
 *
 *   node scripts/migrar.cjs            aplica as pendentes
 *   node scripts/migrar.cjs --testar   roda tudo e desfaz (dry-run)
 */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));

const env = Object.fromEntries(
  fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);
const testar = process.argv.includes('--testar');
const sql = postgres(env.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });

(async () => {
  try {
    await sql`create schema if not exists neo_interno`;
    await sql`create table if not exists neo_interno.migracoes (nome text primary key, aplicada_em timestamptz not null default now())`;
    const feitas = new Set((await sql`select nome from neo_interno.migracoes`).map((r) => r.nome));
    const dir = path.join(raiz, 'supabase/migrations');
    const pendentes = fs.readdirSync(dir).filter((f) => f.endsWith('.sql') && !feitas.has(f)).sort();
    if (!pendentes.length) return console.log('Nada a aplicar.');
    await sql.begin(async (t) => {
      for (const f of pendentes) {
        await t.unsafe(fs.readFileSync(path.join(dir, f), 'utf8'));
        await t`insert into neo_interno.migracoes (nome) values (${f})`;
        console.log('ok', f);
      }
      if (testar) throw new Error('DRY-RUN: desfeito');
    });
    console.log('Aplicadas:', pendentes.length);
  } catch (e) {
    console.log(e.message);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
})();
