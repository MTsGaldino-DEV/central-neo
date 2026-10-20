/**
 * Cópia única TraceOne → central-neo (2026-10-20).
 *
 * - Logins das pessoas (auth.users + identities), com o mesmo id e a mesma senha
 *   (hash bcrypt). Contas de serviço do TraceOne não vêm.
 * - Colaboradores do TraceOne (matrícula = matrícula CEMIG) e um cadastro para cada login.
 * - neo_acessos, NSIS, itens, tabela de valores e histórico de acertos.
 *
 *   node scripts/copiar-do-traceone.cjs            copia
 *   node scripts/copiar-do-traceone.cjs --testar   copia e desfaz
 */
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));

const lerEnv = (f) => Object.fromEntries(fs.readFileSync(f, 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]));
const neoEnv = lerEnv(path.join(raiz, '.env'));
const toEnv = lerEnv(path.join(raiz, '../traceone/frontend/.env.local'));

const CONTAS_DE_SERVICO = ['admin@traceone.com', 'mobile-svc@traceone.com', 'integracao-centralnec@engelmig.com.br'];
const testar = process.argv.includes('--testar');

const origem = postgres({ host: 'aws-0-sa-east-1.pooler.supabase.com', port: 6543, user: 'postgres.ctlaygzndbaojxpwqsco',
  password: toEnv.SUPABASE_DB_PASSWORD, database: 'postgres', ssl: 'require', prepare: false, onnotice: () => {} });
const destino = postgres(neoEnv.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });

/** Colunas comuns aos dois bancos, sem as geradas (que o Postgres calcula). */
async function colunas(schema, tabela) {
  const q = (db) => db`select column_name from information_schema.columns
    where table_schema = ${schema} and table_name = ${tabela} and is_generated = 'NEVER' and generation_expression is null`;
  const [a, b] = await Promise.all([q(origem), q(destino)]);
  const noDestino = new Set(b.map((r) => r.column_name));
  return a.map((r) => r.column_name).filter((c) => noDestino.has(c));
}

async function copiarTabela(t, schema, tabela, linhas, conflito = 'do nothing') {
  if (!linhas.length) return 0;
  const cols = await colunas(schema, tabela);
  let n = 0;
  for (let i = 0; i < linhas.length; i += 500) {
    const lote = linhas.slice(i, i + 500).map((l) => Object.fromEntries(cols.map((c) => [c, l[c] ?? null])));
    const r = await t.unsafe(
      `insert into ${schema}.${tabela} (${cols.map((c) => `"${c}"`).join(',')})
       select ${cols.map((c) => `"${c}"`).join(',')} from json_populate_recordset(null::${schema}.${tabela}, $1::json) on conflict ${conflito}`,
      [t.json(lote)]
    );
    n += r.count;
  }
  return n;
}

(async () => {
  try {
    const usuarios = await origem`select * from auth.users where email <> all(${CONTAS_DE_SERVICO}) order by email`;
    const ids = usuarios.map((u) => u.id);
    const identidades = await origem`select * from auth.identities where user_id = any(${ids})`;
    const perfis = await origem`select id, name from profiles where id = any(${ids})`;
    const colabTO = await origem`select * from colaboradores order by matricula`;
    const acessos = await origem`select * from neo_acessos where user_id = any(${ids})`;
    const nsis = await origem`select * from neo_nsis`;
    const itens = await origem`select * from neo_nsis_itens`;
    const contrato = await origem`select * from neo_contrato_itens`;
    const historico = await origem`select * from neo_contrato_historico`;

    // tokens de texto não podem ser nulos para o GoTrue
    for (const u of usuarios) {
      for (const c of ['confirmation_token', 'recovery_token', 'email_change_token_new', 'email_change',
        'email_change_token_current', 'phone_change', 'phone_change_token', 'reauthentication_token']) {
        if (c in u && u[c] === null) u[c] = '';
      }
    }

    const nomePorId = new Map(perfis.map((p) => [p.id, p.name]));
    const colaboradores = [
      ...colabTO.map((c) => ({ nome: c.nome, matricula_cemig: c.matricula, supervisor: c.supervisor, gc: c.gc, go: c.go,
        ativo: c.ativo, criado_em: c.created_at, atualizado_em: c.updated_at })),
      ...usuarios.map((u) => ({ nome: nomePorId.get(u.id) || u.email.split('@')[0], email: u.email, usuario_id: u.id, ativo: true })),
    ];

    await destino.begin(async (t) => {
      const r = {};
      r.usuarios = await copiarTabela(t, 'auth', 'users', usuarios);
      r.identidades = await copiarTabela(t, 'auth', 'identities', identidades);
      r.colaboradores = 0;
      for (const c of colaboradores) {
        const cols = Object.keys(c);
        const x = await t`insert into public.colaboradores ${t(c, cols)} on conflict do nothing`;
        r.colaboradores += x.count;
      }
      r.acessos = await copiarTabela(t, 'public', 'neo_acessos', acessos, '(user_id) do nothing');
      // a migration 005 carregou a Tabela 03 publicada; vale a do TraceOne (pode ter acertos)
      await t`delete from public.neo_contrato_historico`;
      await t`delete from public.neo_contrato_itens`;
      r.contrato = await copiarTabela(t, 'public', 'neo_contrato_itens', contrato);
      r.historico = await copiarTabela(t, 'public', 'neo_contrato_historico', historico);
      r.nsis = await copiarTabela(t, 'public', 'neo_nsis', nsis);
      r.itens = await copiarTabela(t, 'public', 'neo_nsis_itens', itens);
      console.log('copiado:', r);
      console.log('origem: ', { usuarios: usuarios.length, colaboradores: colaboradores.length, acessos: acessos.length,
        contrato: contrato.length, historico: historico.length, nsis: nsis.length, itens: itens.length });
      if (testar) throw new Error('DRY-RUN: desfeito');
    });
  } catch (e) {
    console.log(e.message);
    process.exitCode = 1;
  } finally {
    await origem.end();
    await destino.end();
  }
})();
