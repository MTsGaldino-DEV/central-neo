// Migrations 054 e 055 (disponibilidade) em transação SEMPRE desfeita. Não usa migrar.cjs, que hoje reaplicaria a 051.
// Depois de aplicadas, o teste vale sobre o banco e continua sem gravar nada.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));
const env = Object.fromEntries(fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const ler = (n) => fs.readFileSync(path.join(raiz, 'supabase/migrations', n), 'utf8');
const sql = postgres(env.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });
const DESFEITO = 'DESFEITO: fim do teste';
const TOTAIS = { 3: 22464, 4: 59616, 5: 34560, 6: 20736, 7: 30240, 8: 36288, 9: 25056, 10: 7776, 11: 0, 12: 0 };
const MULT = ['Veículo Quebrado', 'Atraso superior a 4h', 'Descadastramento Antecipado'];

(async () => {
  let aplicadaAntes = false;
  try {
    await sql.begin(async (t) => {
      const [{ existe }] = await t`select to_regclass('public.neo_disp_lancamentos') is not null existe`;
      aplicadaAntes = existe;
      if (!existe) {
        await t.unsafe(ler('054_disponibilidade.sql'));
        await t.unsafe(ler('055_disponibilidade_historico.sql'));
      }

      // RLS ligada nas três tabelas
      const rls = await t`select relname, relrowsecurity from pg_class where oid in ('public.neo_disp_frotas'::regclass, 'public.neo_disp_lancamentos'::regclass, 'public.neo_disp_config'::regclass)`;
      assert.ok(rls.length === 3 && rls.every((r) => r.relrowsecurity), 'RLS ligada');

      // Pessoas de teste: logins existentes, com o acesso trocado só dentro desta transação.
      const logins = await t`select id from auth.users order by created_at limit 2`;
      assert.equal(logins.length, 2, 'precisa de dois logins para o teste');
      const [usuario, admin] = logins.map((l) => l.id);
      const acesso = (id, papel, modulos) => t`insert into public.neo_acessos (user_id, papel, modulos, ativo) values (${id}, ${papel}, ${modulos}, true)
        on conflict (user_id) do update set papel = excluded.papel, modulos = excluded.modulos, ativo = true`;
      await acesso(usuario, 'USUARIO', []);
      await acesso(admin, 'ADMIN', []);

      const como = async (id, fn) => t.savepoint(async (s) => {
        await s.unsafe(`select set_config('request.jwt.claims', '${JSON.stringify({ sub: id, role: 'authenticated' })}', true)`);
        await s.unsafe('set local role authenticated');
        const r = await fn(s);
        // Voltar ao savepoint desfaz também o papel e o usuário simulados.
        throw Object.assign(new Error('volta'), { resultado: r });
      }).catch((e) => { if (e.message !== 'volta') throw e; return e.resultado; });
      const hoje = (await t`select (now() at time zone 'America/Sao_Paulo')::date::text d`)[0].d;
      const amanha = (await t`select ((now() at time zone 'America/Sao_Paulo')::date + 1)::text d`)[0].d;

      // Totais pelas RPCs, como a tela lê: cada mês igual à planilha recontada
      const lidos = await como(admin, async (s) => {
        const [{ cfg }] = await s`select jsonb_build_object('valor', valor_ocorrencia, 'meta', meta_mensal) cfg from public.neo_disp_config`;
        const [{ ano }] = await s`select public.neo_disp_ano(2026) ano`;
        const [{ out }] = await s`select public.neo_disp_mes(2026, 10) out`;
        const [{ mai }] = await s`select public.neo_disp_mes(2026, 5) mai`;
        const [{ nov }] = await s`select public.neo_disp_mes(2026, 11) nov`;
        const [{ frotas }] = await s`select count(*)::int frotas from public.neo_disp_frotas`;
        return { cfg, ano, out, mai, nov, frotas };
      });
      assert.equal(Number(lidos.cfg.valor), 864);
      assert.equal(Number(lidos.cfg.meta), 30000);
      assert.equal(lidos.frotas, 62);
      assert.equal(lidos.out.length, 62 * 31, 'outubro completo, com o dia 31');
      assert.equal(lidos.mai.length, 62 * 31, 'maio completo, com o dia 31');
      if (!aplicadaAntes) assert.equal(lidos.nov.length, 0, 'novembro começa sem lançamento');
      const porMes = {};
      for (const o of lidos.ano) if (MULT.includes(o.causa)) porMes[+o.dia.slice(5, 7)] = (porMes[+o.dia.slice(5, 7)] || 0) + 864;
      if (!aplicadaAntes) {
        assert.equal(lidos.ano.length, 1031);
        for (const [m, v] of Object.entries(TOTAIS)) assert.equal(porMes[m] || 0, v, 'mês ' + m);
      }
      console.log('por mês:', porMes);

      // Sem o módulo: não lê nem marca
      const semModulo = await como(usuario, async (s) => {
        const [{ n }] = await s`select count(*)::int n from public.neo_disp_lancamentos`;
        const [{ ano }] = await s`select public.neo_disp_ano(2026) ano`;
        return { n, ano };
      });
      assert.deepEqual(semModulo, { n: 0, ano: [] }, 'sem o módulo não vê nada');
      await como(usuario, async (s) => {
        await assert.rejects(s`insert into public.neo_disp_lancamentos (dia, frota, situacao) values (${hoje}, 4052, 'CADASTROU')`, /row-level security/);
      });

      // Com o módulo: marca, troca, limpa; não altera a meta; não marca o futuro nem ocorrência sem causa
      await t`update public.neo_acessos set modulos = array['disponibilidade'] where user_id = ${usuario}`;
      const comModulo = await como(usuario, async (s) => {
        await s`delete from public.neo_disp_lancamentos where dia = ${hoje} and frota = 4052`;
        const [a] = await s`insert into public.neo_disp_lancamentos (dia, frota, situacao, causa, observacao, origem) values (${hoje}, 4052, 'OCORRENCIA', 'Veículo Quebrado', 'oficina', 'PLANILHA') returning origem, atualizado_por::text por`;
        const [b] = await s`insert into public.neo_disp_lancamentos (dia, frota, situacao) values (${hoje}, 4052, 'CADASTROU')
          on conflict (dia, frota) do update set situacao = excluded.situacao, causa = null, observacao = null returning situacao, causa`;
        const apagadas = await s`delete from public.neo_disp_lancamentos where dia = ${hoje} and frota = 4052 returning frota`;
        const meta = await s`update public.neo_disp_config set meta_mensal = 1 returning id`;
        const [{ m }] = await s`select meta_mensal::float8 m from public.neo_disp_config`;
        return { a, b, apagadas: apagadas.length, metaAlteradas: meta.length, m };
      });
      assert.equal(comModulo.a.origem, 'TELA', 'marcação pela tela vira origem TELA');
      assert.equal(comModulo.a.por, usuario, 'grava quem marcou');
      assert.deepEqual({ ...comModulo.b }, { situacao: 'CADASTROU', causa: null });
      assert.equal(comModulo.apagadas, 1, 'limpar funciona');
      assert.equal(comModulo.metaAlteradas, 0, 'usuário comum não altera a meta');
      assert.equal(comModulo.m, 30000);
      await como(usuario, async (s) => {
        await assert.rejects(s`insert into public.neo_disp_lancamentos (dia, frota, situacao) values (${amanha}, 4052, 'CADASTROU')`, /row-level security/);
      });
      await como(usuario, async (s) => {
        await s`delete from public.neo_disp_lancamentos where dia = ${hoje} and frota = 4052`;
        await assert.rejects(s`insert into public.neo_disp_lancamentos (dia, frota, situacao) values (${hoje}, 4052, 'OCORRENCIA')`, /neo_disp_lancamentos_situacao_causa/);
      });
      await como(usuario, async (s) => {
        await assert.rejects(s`insert into public.neo_disp_lancamentos (dia, frota, situacao, causa) values (${hoje}, 4052, 'OCORRENCIA', 'Inventada')`, /check/);
      });
      await como(usuario, async (s) => {
        await assert.rejects(s`insert into public.neo_disp_lancamentos (dia, frota, situacao) values ('2026-03-22', 4052, 'CADASTROU')`, /check/);
      });

      // Admin altera a meta
      const metaAdmin = await como(admin, async (s) => {
        const [r] = await s`update public.neo_disp_config set meta_mensal = 25000 returning meta_mensal::float8 m, atualizado_por::text por`;
        return r;
      });
      assert.equal(metaAdmin.m, 25000);
      assert.equal(metaAdmin.por, admin);

      // Anônimo não lê
      for (const consulta of ['select 1 from public.neo_disp_lancamentos limit 1', 'select public.neo_disp_ano(2026)']) {
        await t.savepoint(async (s) => {
          await s.unsafe('set local role anon');
          await assert.rejects(s.unsafe(consulta), /permission denied/);
          throw new Error('volta');
        }).catch((e) => { if (e.message !== 'volta') throw e; });
      }

      throw new Error(DESFEITO);
    });
  } catch (e) {
    if (e.message !== DESFEITO) { console.error('FALHOU:', e.message); process.exitCode = 1; await sql.end(); return; }
  }
  const [{ existe }] = await sql`select to_regclass('public.neo_disp_lancamentos') is not null existe`;
  assert.equal(existe, aplicadaAntes, 'o teste não pode deixar nada no banco');
  console.log(`PASSOU (transação desfeita; migrations ${aplicadaAntes ? 'já aplicadas' : 'não aplicadas'} no banco)`);
  await sql.end();
})().catch(async (e) => { console.error('FALHOU:', e.message); process.exitCode = 1; await sql.end(); });
