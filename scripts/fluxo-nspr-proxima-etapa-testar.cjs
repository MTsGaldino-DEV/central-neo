// Informar NSPR + valor pago: para qual etapa a NSIS vai? Roda sobre o banco real em transação SEMPRE desfeita.
// Mostra o retrato atual de "Aguardando NSPR" (fluxo novo × histórico) e simula a gravação da NSPR numa NSIS de cada tipo.
// Com --com-correcao simula o que o app faz agora (marca fluxo novo antes da NSPR). Não deixa nada gravado.
const fs = require('fs');
const path = require('path');
const raiz = path.join(__dirname, '..');
const postgres = require(path.join(raiz, '../traceone/frontend/node_modules/postgres'));
const env = Object.fromEntries(fs.readFileSync(path.join(raiz, '.env'), 'utf8').split(/\r?\n/)
  .filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const sql = postgres(env.NEO_DATABASE_URL, { ssl: 'require', prepare: false, onnotice: () => {} });
const DESFEITO = 'DESFEITO: fim do teste';

(async () => {
  try {
    await sql.begin(async (t) => {
      console.log('— Retrato atual: etapa × fluxo —');
      console.table(await t`select etapa, fluxo_novo, count(*)::int as nsis from public.neo_vw_nsis
        where etapa in ('AGUARDANDO_NSPR', 'AGUARDANDO_SALESFORCE', 'AGUARDANDO_FATURA') group by etapa, fluxo_novo order by etapa, fluxo_novo`);

      for (const novo of [true, false]) {
        const [n] = await t`select servico, tipo_serv, fluxo_novo, supervisor, data_lancamento_sf from public.neo_vw_nsis
          where etapa = 'AGUARDANDO_NSPR' and fluxo_novo = ${novo} and tipo_serv <> 'NSRI' and qtd_itens > 0 order by servico limit 1`;
        if (!n) { console.log(`\n[fluxo_novo=${novo}] nenhuma NSIS em Aguardando NSPR para simular.`); continue; }
        // o mesmo que informarNspr grava: marca fluxo novo (com o supervisor que a NSIS já mostra) e depois NSPR + valor pago
        if (process.argv.includes('--com-correcao')) {
          await t`update public.neo_nsis set fluxo_novo = true, supervisor_equipe = coalesce(supervisor_equipe, ${n.supervisor}) where servico = ${n.servico}`;
        }
        await t`update public.neo_nsis_itens set nspr = 'TESTE-NSPR', valor_final = valor_inicial where servico = ${n.servico}`;
        const [depois] = await t`select etapa, itens_sem_nspr, nsprs from public.neo_vw_nsis where servico = ${n.servico}`;
        console.log(`\n[fluxo_novo=${novo}] NSIS ${n.servico} (${n.tipo_serv}) depois de informar NSPR + valor → etapa: ${depois.etapa} (sem NSPR: ${depois.itens_sem_nspr})`);
      }
      // NSRI: a etapa 1 grava a NSMC no NSMP e no NSPR, junto com o valor pago → vai direto para o Salesforce
      const [r] = await t`select servico from public.neo_vw_nsis where tipo_serv = 'NSRI' and etapa = 'A_FECHAR' and qtd_itens = 0 order by servico limit 1`;
      if (r) {
        await t`insert into public.neo_nsis_itens (servico, descricao, quantidade, valor_inicial, valor_final, equipe, nsmp, nspr)
          values (${r.servico}, 'TESTE NSRI', 1, 1, 1, 'TESTE', 'NSMC-TESTE', 'NSMC-TESTE')`;
        const [d] = await t`select etapa, nsmps, nsprs from public.neo_vw_nsis where servico = ${r.servico}`;
        console.log(`\n[NSRI] NSIS ${r.servico} com NSMC no NSMP e no NSPR + valor pago → etapa: ${d.etapa} (NSMP ${d.nsmps}, NSPR/NSMC ${d.nsprs})`);
      } else console.log('\n[NSRI] nenhuma NSRI em A fechar sem itens para simular.');
      throw new Error(DESFEITO);
    });
  } catch (e) {
    if (e.message !== DESFEITO) { console.error('FALHOU:', e.message); process.exitCode = 1; }
    else console.log('\n(transação desfeita: nada foi gravado)');
  } finally {
    await sql.end();
  }
})();
