// Migration 053 (fator do item) em transação SEMPRE desfeita. Só carrega a 053: não usa migrar.cjs,
// que hoje reaplicaria a 051. Rode antes de aplicar; depois de aplicada, o teste vale sobre o banco.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));
const env = Object.fromEntries(fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const migracao = fs.readFileSync(path.join(raiz, 'supabase/migrations/053_manutencao_fator_item.sql'), 'utf8');
const sql = postgres(env.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });
const DESFEITO = 'DESFEITO: fim do teste';

(async () => {
  try {
    await sql.begin(async (t) => {
      const [antes] = await t`select count(*)::int itens, coalesce(sum(valor_inicial), 0)::text pedido from public.neo_nsis_itens`;
      const colunasAntes = (await t`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'neo_vw_itens' order by ordinal_position`).map((c) => c.column_name);

      // depois de aplicada, o teste confere o banco real em vez de recarregar a migration
      const [{ aplicada }] = await t`select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'neo_nsis_itens' and column_name = 'fator') aplicada`;
      if (!aplicada) await t.unsafe(migracao);

      // a view mantém as colunas na mesma ordem e ganha o fator no fim
      const colunas = (await t`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'neo_vw_itens' order by ordinal_position`).map((c) => c.column_name);
      const novas = colunasAntes.includes('fator') ? colunasAntes : [...colunasAntes, 'fator'];
      assert.deepEqual(colunas, novas);
      const [opcoes] = await t`select reloptions from pg_class where oid = 'public.neo_vw_itens'::regclass`;
      assert.ok(opcoes.reloptions.includes('security_invoker=true'), 'a view continua respeitando a RLS de quem consulta');

      // itens existentes: nada muda
      const [depois] = await t`select count(*)::int itens, coalesce(sum(valor_inicial), 0)::text pedido, count(*) filter (where fator <> 1.0)::int outros from public.neo_nsis_itens where not rural`;
      assert.equal(depois.itens, antes.itens);
      assert.equal(depois.pedido, antes.pedido);
      assert.equal(depois.outros, 0, 'item existente fica com fator 1,0');

      // só 1,0, 1,2 e 1,4
      const servico = 'TESTE-053';
      await t`insert into public.neo_nsis (servico, origem) values (${servico}, 'MANUAL')`;
      await t.savepoint(async (s) => {
        await assert.rejects(s`insert into public.neo_nsis_itens (servico, descricao, fator) values (${servico}, 'x', 1.3)`, /neo_nsis_itens_fator_check/);
        throw new Error('volta');
      }).catch((e) => { if (e.message !== 'volta') throw e; });

      // Contrato 2026 usa o fator: 1,4 × quantidade × fator_original
      const [c] = await t`select codigo, fator_original::float8 f from public.neo_contrato_itens where fator_original > 0 and ativo order by codigo limit 1`;
      const [a] = await t`insert into public.neo_nsis_itens (servico, descricao, codigo, quantidade, fator, fator_unitario, valor_inicial)
        values (${servico}, 'a', ${c.codigo}, 2, 1.4, ${c.f}, ${c.f}) returning id`;
      const [b] = await t`insert into public.neo_nsis_itens (servico, descricao, codigo, quantidade, fator, fator_unitario, valor_inicial)
        values (${servico}, 'b', ${c.codigo}, 1, 1.0, ${c.f}, ${c.f}) returning id`;
      const [va] = await t`select valor_contrato::float8 v, fator::float8 f from public.neo_vw_itens where id = ${a.id}`;
      const [vb] = await t`select valor_contrato::float8 v from public.neo_vw_itens where id = ${b.id}`;
      assert.equal(va.f, 1.4);
      assert.equal(va.v, Math.round(c.f * 2 * 1.4 * 10000) / 10000);
      assert.equal(vb.v, Math.round(c.f * 10000) / 10000);

      // dois códigos na mesma NSMP: a etapa e os números da NSIS funcionam sem mudança
      assert.equal((await t`select etapa from public.neo_vw_nsis where servico = ${servico}`)[0].etapa, 'AGUARDANDO_NSMP');
      await t`update public.neo_nsis_itens set nsmp = 'N1' where servico = ${servico}`;
      const [n1] = await t`select etapa, nsmps from public.neo_vw_nsis where servico = ${servico}`;
      assert.equal(n1.etapa, 'AGUARDANDO_NSPR');
      assert.equal(n1.nsmps, 'N1', 'a NSMP aparece uma vez só na fila');
      await t`update public.neo_nsis_itens set nspr = 'P1', fatura = 'AP 1', valor_final = valor_inicial where servico = ${servico}`;
      const [n2] = await t`select etapa, itens_divergentes::int d from public.neo_vw_nsis where servico = ${servico}`;
      assert.equal(n2.etapa, 'FATURADA');
      assert.equal(n2.d, 0);

      // a tela confirma a NSPR com insert ... on conflict: precisa passar pela RLS de um usuário comum
      const [acesso] = await t`select user_id from public.neo_acessos where ativo and papel = 'ADMIN' limit 1`;
      await t`select set_config('request.jwt.claim.sub', ${acesso.user_id}, true), set_config('request.jwt.claims', ${JSON.stringify({ sub: acesso.user_id, role: 'authenticated' })}, true)`;
      await t.unsafe('set local role authenticated');
      const linhas = [{ id: a.id, valor_final: 0.1 }, { id: b.id, valor_final: 0.2 }];
      for (const l of linhas) {
        await t`insert into public.neo_nsis_itens (id, servico, descricao, nspr, valor_final)
          values (${l.id}, ${servico}, 'ignorada', 'P2', ${l.valor_final})
          on conflict (id) do update set servico = excluded.servico, descricao = excluded.descricao, nspr = excluded.nspr, valor_final = excluded.valor_final`;
      }
      const confirmados = await t`select nspr, valor_final::float8 v, codigo from public.neo_nsis_itens where servico = ${servico} order by v`;
      assert.deepEqual(confirmados.map((r) => [r.nspr, r.v, r.codigo]), [['P2', 0.1, c.codigo], ['P2', 0.2, c.codigo]], 'só a NSPR e o valor mudam; o código fica');
      assert.equal((await t`select count(*)::int n from public.neo_nsis_itens where servico = ${servico}`)[0].n, 2, 'não cria linha nova');

      throw new Error(DESFEITO);
    });
  } catch (e) {
    if (e.message !== DESFEITO) { console.error(e); process.exitCode = 1; return; }
    console.log('OK: colunas da view, RLS, itens existentes, fatores aceitos, Contrato 2026 e etapa com NSMP compartilhada (tudo desfeito).');
  } finally {
    await sql.end();
  }
})();
