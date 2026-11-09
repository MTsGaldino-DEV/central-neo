// Migration 056 (fluxo novo da fila de NSIS) em transação SEMPRE desfeita. Só carrega a 056: não usa migrar.cjs.
// Rode antes de aplicar; depois de aplicada, o teste vale sobre o banco real. Não deixa nada no banco.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));
const env = Object.fromEntries(fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const migracao = fs.readFileSync(path.join(raiz, 'supabase/migrations/056_fila_fluxo_novo.sql'), 'utf8');
const sql = postgres(env.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });
const DESFEITO = 'DESFEITO: fim do teste';

(async () => {
  try {
    await sql.begin(async (t) => {
      const [{ aplicada }] = await t`select exists (select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'neo_nsis' and column_name = 'fluxo_novo') as aplicada`;
      const etapasAntes = aplicada ? null : Object.fromEntries((await t`select etapa, count(*)::int n from public.neo_vw_nsis group by etapa`).map((r) => [r.etapa, r.n]));
      const [totalAntes] = await t`select count(*)::int n from public.neo_nsis`;
      if (!aplicada) await t.unsafe(migracao);

      // (a) colunas: as antigas continuam e as três novas existem; a view respeita a RLS de quem consulta
      const colunas = (await t`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'neo_vw_nsis'`).map((r) => r.column_name);
      for (const c of ['servico', 'etapa', 'supervisor', 'codigos', 'itens_sem_valor_pago', 'valor_us_reais', 'fluxo_novo', 'supervisor_equipe', 'data_lancamento_sf']) {
        assert.ok(colunas.includes(c), `a view tem a coluna ${c}`);
      }
      const [opcoes] = await t`select reloptions from pg_class where oid = 'public.neo_vw_nsis'::regclass`;
      assert.ok(opcoes.reloptions.includes('security_invoker=true'), 'a view continua respeitando a RLS');

      // (g) backfill: histórico e NSIS com itens ficam de fora do fluxo novo
      const [h] = await t`select count(*)::int n from public.neo_nsis where fluxo_novo and origem = 'HISTORICO'`;
      assert.equal(h.n, 0, 'nenhuma NSIS de origem HISTORICO entra no fluxo novo');
      const [c] = await t`select count(*)::int n from public.neo_nsis n where fluxo_novo
        and exists (select 1 from public.neo_nsis_itens it where it.servico = n.servico)`;
      assert.equal(c.n, 0, 'nenhuma NSIS com itens entra no fluxo novo');
      const [total] = await t`select count(*)::int n from public.neo_nsis`;
      assert.equal(total.n, totalAntes.n, 'a migration não cria nem apaga NSIS');
      // o histórico mantém a etapa que tinha (só o que saiu de A_FECHAR para o fluxo novo continua A_FECHAR)
      if (etapasAntes) {
        const depois = Object.fromEntries((await t`select etapa, count(*)::int n from public.neo_vw_nsis group by etapa`).map((r) => [r.etapa, r.n]));
        assert.deepEqual(depois, etapasAntes, 'a contagem por etapa não muda com a migration');
      }

      // (b) etapas do fluxo novo, NSIS comum
      const NSIS = 'TESTE-056-A';
      await t`insert into public.neo_nsis (servico, origem, fluxo_novo, tipo_serv, localidade) values (${NSIS}, 'MANUAL', true, 'NSIS', '1234')`;
      const etapa = async (s) => (await t`select etapa from public.neo_vw_nsis where servico = ${s}`)[0].etapa;
      assert.equal(await etapa(NSIS), 'A_FECHAR');
      await t`insert into public.neo_nsis_itens (servico, descricao, quantidade, valor_inicial, equipe, nsmp)
        values (${NSIS}, 'item', 1, 1, '4404', 'NSMP1')`;
      assert.equal(await etapa(NSIS), 'AGUARDANDO_NSPR');
      await t`update public.neo_nsis_itens set nspr = 'NSPR1', valor_final = 1 where servico = ${NSIS}`;
      assert.equal(await etapa(NSIS), 'AGUARDANDO_SALESFORCE');
      await t`update public.neo_nsis set data_lancamento_sf = '2026-11-09' where servico = ${NSIS}`;
      assert.equal(await etapa(NSIS), 'AGUARDANDO_APROPRIACAO');
      await t`update public.neo_nsis_itens set fatura = 'AP 1' where servico = ${NSIS}`;
      assert.equal(await etapa(NSIS), 'FATURADA');

      // sem cobrança continua valendo
      await t`update public.neo_nsis set sem_cobranca = true, motivo_sem_cobranca = 'teste' where servico = ${NSIS}`;
      assert.equal(await etapa(NSIS), 'SEM_COBRANCA');

      // (c) NSRI: sem NSPR, vai da etapa 1 para o Salesforce e depois para a apropriação
      const NSRI = 'TESTE-056-NSRI';
      await t`insert into public.neo_nsis (servico, origem, fluxo_novo, tipo_serv) values (${NSRI}, 'MANUAL', true, 'NSRI')`;
      await t`insert into public.neo_nsis_itens (servico, descricao, quantidade, valor_inicial, valor_final, equipe, nsmp)
        values (${NSRI}, 'item', 1, 1, 1, '4404', 'NSMC1')`;
      assert.equal(await etapa(NSRI), 'AGUARDANDO_SALESFORCE');
      await t`update public.neo_nsis set data_lancamento_sf = '2026-11-09' where servico = ${NSRI}`;
      assert.equal(await etapa(NSRI), 'AGUARDANDO_APROPRIACAO');
      await t`update public.neo_nsis_itens set fatura = 'AP 2' where servico = ${NSRI}`;
      assert.equal(await etapa(NSRI), 'FATURADA');

      // (d) histórico com os mesmos dados segue a regra antiga
      const HIST = 'TESTE-056-HIST';
      await t`insert into public.neo_nsis (servico, origem, fluxo_novo) values (${HIST}, 'HISTORICO', false)`;
      await t`insert into public.neo_nsis_itens (servico, descricao, quantidade, valor_inicial, valor_final, nsmp, nspr)
        values (${HIST}, 'item', 1, 1, 1, 'N', 'P')`;
      assert.equal(await etapa(HIST), 'AGUARDANDO_FATURA');
      await t`update public.neo_nsis_itens set fatura = 'AP 3' where servico = ${HIST}`;
      assert.equal(await etapa(HIST), 'FATURADA');

      // supervisor: do fluxo novo vem de supervisor_equipe; do histórico, da localidade
      await t`update public.neo_nsis set supervisor_equipe = 'Fulano', sem_cobranca = false where servico = ${NSIS}`;
      assert.equal((await t`select supervisor from public.neo_vw_nsis where servico = ${NSIS}`)[0].supervisor, 'Fulano');

      // (h) painel e resumo continuam respondendo com as etapas novas
      const [{ data }] = await t`select current_date::text as data`;
      await t`select public.neo_painel_fechamento(${data}::date, ${data}::date)`;
      const [resumo] = await t`select public.neo_resumo_fechamento() as r`;
      assert.ok(resumo.r.etapas, 'o resumo traz as etapas');

      // RPCs: precisam passar pela RLS de um usuário com o módulo (admin)
      const [frota] = await t`select frota, supervisor from public.neo_disp_frotas limit 1`;
      const [acesso] = await t`select user_id from public.neo_acessos where ativo and papel = 'ADMIN' limit 1`;
      await t`select set_config('request.jwt.claim.sub', ${acesso.user_id}, true), set_config('request.jwt.claims', ${JSON.stringify({ sub: acesso.user_id, role: 'authenticated' })}, true)`;
      await t.unsafe('set local role authenticated');

      // (e) supervisor da equipe
      const sup = async (e) => (await t`select public.neo_supervisor_da_equipe(${e}) as s`)[0].s;
      assert.equal(await sup(String(frota.frota)), frota.supervisor);
      assert.equal(await sup(` ${frota.frota} `), frota.supervisor, 'espaços em volta não atrapalham');
      assert.equal(await sup('abc'), null);
      assert.equal(await sup('999999'), null);
      assert.equal(await sup(''), null);
      assert.equal(await sup('99999999999999'), null, 'número gigante não estoura');

      // (f) importação: NSIS nova nasce no fluxo novo; reimportar não mexe na marca
      const linha = (s) => t.json([{ servico: s, tipo_serv: 'NSIS', localidade: '1234', observacao: 'x' }]);
      await t`select public.neo_importar_nsis(${linha('TESTE-056-IMP')})`;
      const fluxo = async (s) => (await t`select fluxo_novo from public.neo_nsis where servico = ${s}`)[0].fluxo_novo;
      assert.equal(await fluxo('TESTE-056-IMP'), true);
      await t`select public.neo_importar_nsis(${linha('TESTE-056-IMP')})`;
      assert.equal(await fluxo('TESTE-056-IMP'), true);
      await t`select public.neo_importar_nsis(${linha(HIST)})`;
      assert.equal(await fluxo(HIST), false, 'reimportar não leva o histórico para o fluxo novo');

      throw new Error(DESFEITO);
    });
  } catch (e) {
    if (e.message !== DESFEITO) { console.error(e); process.exitCode = 1; return; }
    console.log('OK: colunas, backfill, etapas do fluxo novo e da NSRI, histórico, supervisor da equipe, importação, painel e resumo (tudo desfeito).');
  } finally {
    await sql.end();
  }
})();
