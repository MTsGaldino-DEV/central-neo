# Faturamento UI/UX e conferência por serviço — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesenhar as abas de Faturamento (lista de faturas, Resumo, Conferência por serviço, Importar, Tabelas, Documentação) para mostrar com clareza quanto a CEMIG pagou a menos e a mais, com carregamento instantâneo e importação segura.

**Architecture:** O banco ganha uma view por serviço (`neo_fat_servicos`) sobre `neo_fat_calculo`, revisão manual por serviço e uma tabela de totais pré-calculados por fatura (`neo_fat_totais`), recalculada sob demanda. O frontend consome RPCs novas, guarda os últimos dados em cache local e usa componentes compartilhados (cabeçalho-filtro, janela modal, gráficos CSS) em todas as telas.

**Tech Stack:** React 19, Vite 6, Tailwind v4 (tokens em `src/index.css`), react-router 6, Supabase/Postgres, `xlsx`, `lucide-react`, `motion`. Testes: scripts Node em `scripts/*-testar.cjs` com `node:assert/strict`. Os testes de SQL rodam numa transação com rollback no banco CENTRAL-NEO (`.env` → `NEO_DATABASE_URL`). Os testes de TS puro carregam `.ts` via `typescript.transpileModule`, no padrão de `scripts/faturamento-planilhas-testar.cjs`. Os testes de UI usam Playwright interceptando o Supabase, no padrão de `scripts/faturamento-ui-testar.cjs`.

**Spec:** `docs/superpowers/specs/2026-10-26-faturamento-ux-design.md`

## Global Constraints

- Nunca editar migrations aplicadas (001–027). As novas começam em `028_` e passam por `node scripts/migrar.cjs --testar` antes de `node scripts/migrar.cjs`.
- Objetos de banco com o prefixo `neo_fat_`. As RPCs começam com `if not neo_tem_modulo('faturamento') then raise exception 'Sem acesso ao Faturamento.' using errcode='42501'; end if;`. São `security definer set search_path=public`, com `revoke all ... from public,anon` e `grant execute ... to authenticated`.
- Seis casas decimais. A tolerância vem de `neo_fat_config.tolerancia` (0,000001). O formato na tela usa `usFat` de `src/lib/faturamento.ts`.
- Cores só por token do `src/index.css` (`sinal`, `cobre`, `noite`, `nevoa`, `linha`, `aco`, `erro`, `concluido`, `pendente`, `revisao`…). Fontes `font-sans` (Manrope) e `font-codigo` (JetBrains Mono).
- Nenhum `<input type="date">` nas telas de Faturamento.
- Legendas e rótulos de gráfico em HTML com tamanho fixo (`text-[11px]`), nunca `<text>` dentro de SVG que escala.
- Multas = glosa negativa (`greatest(-glosa,0)`). Estorno = glosa positiva. Nenhum dos dois entra no saldo.
- Saldo a receber = Σ `max(devido − creditado, 0)` dos serviços **não conferidos**, com devido calculável e diferença acima da tolerância. Pago a mais = Σ `max(creditado − devido, 0)`, com os mesmos filtros.
- Linguagem da interface: português simples, frases curtas.
- Toda mensagem de commit segue o formato abaixo:

  ```
  <tipo>(faturamento): <descrição>

  Corrigimos alguns erros e melhoramos a experiência geral. Até Breve, Matheus

  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  ```

  Antes de cada commit, rodar `git status`: o Codex usa o mesmo diretório. Não incluir `ns_preventiva_c_fonte.jsp` nem arquivos de outros.
- Não mexer em Fechamento, TraceOne nem nas regras de negócio abertas do relatório (NOTA 10, rural de Moto, PSAP, 5.62).

## Review Focus

1. **Banco vazio ou fatura sem serviços a menos.** Espera-se: estados vazios com frase e ação (por exemplo "Nenhuma fatura importada. Importe a primeira."), nunca uma tela em branco ou "undefined". O teste fica na Task 12 (UI) e cobre `/faturamento` sem faturas e a Conferência com `a_menos.servicos=0`.
2. **`localStorage` bloqueado ou lançando exceção** (aba anônima, dados bloqueados). Espera-se: a tela carrega normalmente, só sem o cache. O teste fica na Task 5, com `armazenamento` que lança exceção.
3. **Totais desatualizados depois de reimportar, conferir ou corrigir o contrato.** Espera-se: a lista e o Resumo nunca mostram um saldo antigo como atual. O teste fica na Task 3: alterar `importado_em` e verificar o recálculo em `neo_fat_painel`.
4. **Milhares de serviços a menos e exportação grande.** Espera-se: a lista pagina de 50 em 50 e a exportação inclui todos, sem estourar o tempo. O teste fica na Task 2 (`p_limite` 1000, total coerente) e na Task 12 (exportação com 1500 serviços percorre as páginas).
5. **Celular (390 px).** Espera-se: nenhuma rolagem horizontal da página, cartões empilhados e a janela modal ocupando a largura. O teste fica na Task 12, com viewport 390×844 e `scrollWidth <= innerWidth` em cada rota.

---

### Task 1: View por serviço e conferência por serviço (migration 028)

**Files:**
- Create: `supabase/migrations/028_faturamento_servicos.sql`
- Create: `scripts/faturamento-servicos-testar.cjs`

**Interfaces:**
- Produces:
  - **View `public.neo_fat_servicos`** (`security_invoker=false`, `where (select neo_tem_modulo('faturamento'))`), com uma linha por `(fatura, numserv)`. Colunas:
    - identificação e contexto: `fatura text, numserv text, qtd_linhas int, codigos text[]` (em ordem de `id`), `codigo_principal text` (primeiro código com devido não nulo), `tipo_serv text` (min), `tabela text` ('11', '12' ou 'MISTO'), `cidade text` (min), `tipo_turma text, numvei text, ident_turma text`;
    - valores: `creditado numeric, multas numeric, estorno numeric, devido numeric` (null se nenhuma linha tem fator), `fator_aplicado text` ('CSC' ou 'COD'), `moto boolean, bate boolean, parcial boolean` (alguma linha sem fator e outra com), `rc_por_atendimento boolean, diferenca numeric` (`creditado - devido`);
    - classificação: `situacao text` ∈ {`OK`, `A_MENOS`, `A_MAIS`, `FORA_CONTRATO`, `CONFERIDO`}, `motivo text` (ver abaixo, null quando `OK`, `FORA_CONTRATO` ou `CONFERIDO` vindo de `OK`);
    - revisão: `observacao_manual text, conferido_por uuid, conferido_em timestamptz, revisao_desatualizada boolean, situacao_calculo text` (a situação antes da revisão manual), `contexto jsonb`.
  - **Tabela `public.neo_fat_conferencias_servico`**: `fatura text references neo_fat_faturas(id) on delete cascade, numserv text, observacao text not null, contexto jsonb not null, usuario uuid default auth.uid(), data timestamptz default now(), primary key(fatura,numserv)`. RLS habilitado, sem policies (acesso só pelas RPCs).
  - `neo_fat_conferir_servico(p_fatura text, p_numserv text, p_observacao text) returns void`: observação com no mínimo 3 caracteres; senão `'Escreva uma observação.'`.
  - `neo_fat_desconferir_servico(p_fatura text, p_numserv text) returns void`.

- [ ] **Step 1: Write the failing test** `scripts/faturamento-servicos-testar.cjs`. Copie o cabeçalho de conexão de `scripts/faturamento-conferencia-testar.cjs`. Tudo roda dentro de `sql.begin` como ADMIN autenticado e termina com `throw new Error('rollback')`, capturado de propósito. Asserções:

```js
const [t9844]=await t`select count(*)::int n,sum(creditado) cred,sum(multas) multas,sum(estorno) est,sum(qtd_linhas)::int linhas from neo_fat_servicos where fatura='9844'`;
assert.equal(t9844.n,21910);assert.equal(t9844.linhas,27389);
assert.equal(Number(t9844.cred).toFixed(6),'917.112183');
assert.equal(Number(t9844.multas).toFixed(6),'21.226389');
assert.equal(Number(t9844.est).toFixed(6),'7.446161');
const s=async n=>(await t`select * from neo_fat_servicos where fatura='9844' and numserv=${n}`)[0];
assert.equal((await s('245530193')).situacao,'OK');            // RC07 pago 1x, 2ª linha zerada
assert.equal((await s('245530193')).rc_por_atendimento,true);
const nssr=await s('242861522');                                 // dois códigos, cada um pago
assert.deepEqual([...nssr.codigos].sort(),['7.10','7.15']);assert.equal(nssr.qtd_linhas,2);
assert.equal(nssr.rc_por_atendimento,false);
assert.equal((await s('245531435')).moto,true);                 // 6.01 Moto, fator 1
assert.equal((await s('246450669')).tabela,'11');               // RC07→8.82 transposto
// revisão por serviço tira do saldo
const alvo=(await t`select numserv from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' limit 1`)[0].numserv;
await t`select neo_fat_conferir_servico('9844',${alvo},'teste de conferência')`;
assert.equal((await s(alvo)).situacao,'CONFERIDO');
await t`select neo_fat_desconferir_servico('9844',${alvo})`;
assert.equal((await s(alvo)).situacao,'A_MENOS');
await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_conferir_servico('9844',${alvo},'ab')`),/observação/);
// relatório para o Matheus (não é asserção)
const [dev]=await t`select sum(devido) d from neo_fat_servicos where fatura='9844'`;
console.log('Devido por serviço:',Number(dev.d).toFixed(6),'· antes 857.921936');
console.table(await t`select situacao,motivo,count(*)::int n,round(sum(abs(diferenca)),6) us from neo_fat_servicos where fatura='9844' group by 1,2 order by 1,2`);
```

  Depois, num segundo `sql.begin` com o usuário `'00000000-0000-0000-0000-000000000000'`: `select count(*) from neo_fat_servicos` = 0, e `neo_fat_conferir_servico` rejeita com `/Sem acesso/`.

- [ ] **Step 2: Run test to verify it fails**

  Run: `node scripts/faturamento-servicos-testar.cjs`
  Expected: FAIL com `relation "neo_fat_servicos" does not exist`.

- [ ] **Step 3: Implement `028_faturamento_servicos.sql`**

  A view agrega `neo_fat_calculo` por `(fatura, numserv)`. O algoritmo abaixo é o que o spec fixa (seções 6.1, 6.4 e 7); o resto fica a seu critério.

  - `rc_por_atendimento` = `bool_and(tabela='12') and min(tipo_serv)=max(tipo_serv)`, como em `neo_fat_base`/025.
  - Para cada candidato `(fator, moto)` ∈ {(CSC,f), (COD,f), (CSC,t), (COD,t)}, restrito a `tipo_turma is null or moto=(tipo_turma='M')`:
    - o devido do candidato é `max` dos devidos da linha quando `rc_por_atendimento`, senão a `sum`;
    - as colunas de linha vêm de `neo_fat_calculo`: `devido_csc`, `devido_cod`, `moto_csc`, `moto_cod`;
    - só entram linhas com devido não nulo, e se todas forem nulas o devido do candidato é null.
  - `bate` = `abs(creditado_servico − devido_candidato) <= tolerancia`. Escolha `order by bate desc, moto, fator desc limit 1`, a mesma ordem de 025. Se nenhum candidato bate: CSC, com `moto = (tipo_turma='M')`.
  - `situacao_calculo`:
    - `FORA_CONTRATO` se o devido é null;
    - `OK` se bate;
    - `A_MENOS` se `creditado < devido − tolerancia`;
    - senão `A_MAIS`.
  - `motivo`, em ordem de prioridade:
    - `A_MENOS`:
      - `'MOTO_INDEVIDO'` se `tipo_turma is distinct from 'M'` e `creditado` bate com o devido do candidato moto do mesmo fator (calculado sem a restrição de equipe), ou se `abs(creditado − 0.7*devido) <= tolerancia*qtd_linhas`;
      - `'RC_NAO_PAGO'` se `rc_por_atendimento and creditado=0`;
      - `'FATOR_MENOR'` se `creditado > 0`;
      - senão `'OUTRA'` (código não pago).
    - `A_MAIS`:
      - `'RC_VARIAS_LINHAS'` se `rc_por_atendimento and count(*) filter(where creditado>0) > 1`;
      - `'FATOR_MAIOR'` em qualquer outro caso com `devido > 0`;
      - senão `'OUTRA'`.
  - `contexto` = `jsonb_build_array(devido, fator_aplicado, moto, tipo_turma, numvei, ident_turma, situacao_calculo, creditado, multas, estorno)`. A revisão vale quando `h.contexto = contexto`; senão `revisao_desatualizada = true` e a situação volta para `situacao_calculo`, como em 027.
  - **Migração das revisões por linha antigas:** inserir em `neo_fat_conferencias_servico` uma linha por serviço que tenha revisão em `neo_fat_conferencias`. A observação é `string_agg(observacao, ' | ')`, e o `contexto` é `'[]'::jsonb`, para nascer desatualizada e pedir nova revisão sem perder o texto.
  - Índice auxiliar para a agregação, se o plano de execução pedir: `create index if not exists neo_fat_linhas_servico on neo_fat_linhas(fatura,numserv)`.

- [ ] **Step 4: Run `node scripts/migrar.cjs --testar`, then the test**

  Expected: a migration passa no dry-run. O teste ainda falha porque ela não foi aplicada. Aplique com `node scripts/migrar.cjs` e rode `node scripts/faturamento-servicos-testar.cjs`: PASS. A tabela de `situacao/motivo` vai impressa no relatório final para o Matheus. Se `OUTRA` passar de 20% dos serviços com diferença, anotar no relatório: é preciso refinar com dados.

- [ ] **Step 5: Commit** `feat(faturamento): calcula conferência por serviço` (migration + script).

---

### Task 2: RPCs de listagem e detalhe por serviço (migration 029)

**Files:**
- Create: `supabase/migrations/029_faturamento_servicos_rpc.sql`
- Modify: `scripts/faturamento-servicos-testar.cjs`

**Interfaces:**
- Consumes: `neo_fat_servicos` (Task 1).
- Produces:
  - **`neo_fat_servicos_listar(p_filtros jsonb, p_offset int default 0, p_limite int default 50) returns jsonb`**
    - Filtros, todos opcionais: `fatura`, `lado` ∈ {`a_menos`, `a_mais`, `todos`} (padrão `todos`), `motivo`, `situacao`, `conferidos` ∈ {`incluir`, `somente`, `excluir`} (padrão `excluir` quando `lado` ≠ `todos`, senão `incluir`), `tipo_turma`, `codserv` (contido em `codigos`), `cidade`, `tipo_serv`, `q` (numserv ilike).
    - `lado='a_menos'` ⇒ `situacao_calculo='A_MENOS'`; `lado='a_mais'` ⇒ `situacao_calculo='A_MAIS'`.
    - Ordenação: `a_menos` por `diferenca asc`, `a_mais` por `diferenca desc`, e `todos` por `numserv`.
    - Retorna `{total int, servicos jsonb[] (todas as colunas da view), lados:{a_menos:{us numeric, servicos int, por_motivo:{<motivo>:{us,servicos}}}, a_mais:{…}}}`.
    - `lados` ignora `lado`, `motivo` e `conferidos` (sempre exclui os conferidos) e respeita os demais filtros.
    - Paginação inválida (`offset<0`, `limite<1` ou `>1000`) ⇒ `'Paginação inválida.'`.
  - **`neo_fat_servico_linhas(p_fatura text, p_numserv text) returns jsonb`**: um array de linhas de `neo_fat_calculo` daquele serviço, em ordem de `id`, com `id, codserv, tabela, urbano, rural, creditado, glosa, devido_csc, devido_cod, moto_csc, moto_cod, justificativa, observacoes`.

- [ ] **Step 1: Add failing assertions** to the script:

```js
const [r]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844',lado:'a_menos'})},0,50) d`;
assert.ok(r.d.total>0);assert.ok(r.d.servicos.length<=50);
assert.ok(r.d.servicos.every(x=>x.situacao_calculo==='A_MENOS'));
assert.ok(r.d.servicos.every((x,i,a)=>!i||Number(a[i-1].diferenca)<=Number(x.diferenca)));
const [v]=await t`select sum(devido-creditado) us,count(*)::int n from neo_fat_servicos where fatura='9844' and situacao='A_MENOS'`;
assert.equal(Number(r.d.lados.a_menos.us).toFixed(6),Number(v.us).toFixed(6));
assert.equal(r.d.lados.a_menos.servicos,v.n);
const soma=Object.values(r.d.lados.a_menos.por_motivo).reduce((s,m)=>s+m.servicos,0);
assert.equal(soma,v.n);
const [big]=await t`select neo_fat_servicos_listar(${t.json({fatura:'9844'})},0,1000) d`;
assert.equal(big.d.total,21910);assert.equal(big.d.servicos.length,1000);
await assert.rejects(()=>t.savepoint(x=>x`select neo_fat_servicos_listar('{}'::jsonb,0,1001)`),/Paginação/);
const [l]=await t`select neo_fat_servico_linhas('9844','245530193') d`;
assert.equal(l.d.length,2);assert.ok(Number(l.d[0].creditado)>0);assert.equal(Number(l.d[1].creditado),0);
```

  E, no bloco sem acesso: as duas RPCs rejeitam com `/Sem acesso/`.

- [ ] **Step 2: Run the test.** Expected: FAIL com `function neo_fat_servicos_listar(...) does not exist`.
- [ ] **Step 3: Implement migration 029** no padrão de `neo_fat_listar` (021): checagem de acesso uma vez e consulta como dono.
- [ ] **Step 4:** `node scripts/migrar.cjs --testar`, depois `node scripts/migrar.cjs`, depois o teste. Expected: PASS. Registrar o tempo da primeira página de `a_menos` (o alvo é menos de 3 s, igual ou melhor que `neo_fat_listar`).
- [ ] **Step 5: Commit** `feat(faturamento): lista serviços pagos a menos e a mais`.

---

### Task 3: Totais pré-calculados por fatura (migration 030)

**Files:**
- Create: `supabase/migrations/030_faturamento_totais.sql`
- Modify: `scripts/faturamento-servicos-testar.cjs`

**Interfaces:**
- Consumes: `neo_fat_servicos`, `neo_fat_anexos` (aba `Debito_Credito`), `neo_fat_faturas`.
- Produces:
  - Tabela `neo_fat_totais(fatura text primary key references neo_fat_faturas(id) on delete cascade, dados jsonb not null, calculado_em timestamptz not null default clock_timestamp())`, com RLS e sem policies. O upsert também grava `clock_timestamp()`, e não `now()`: dentro de uma transação `now()` é constante, e o teste de desatualização depende disso.
  - `neo_fat_atualizar_totais(p_fatura text) returns jsonb`: recalcula, faz upsert e devolve `dados`.
  - **Formato de `dados`** (o frontend depende dele):

    ```
    {fatura, inicio, fim, importado_em,
     linhas, servicos, creditado, multas, estorno, devido, diferenca,   -- diferenca = creditado - devido (manchete)
     sem_fator_servicos, parciais,
     saldo_a_receber, pago_a_mais,                                       -- só não conferidos
     a_menos:{servicos, por_motivo:{…}}, a_mais:{servicos, por_motivo:{…}},
     funil:{importados, equipe_identificada, codigo_no_contrato, valor_confere, conferidos},
     grupos:{tipo_turma:[{valor,servicos,creditado,devido,multas}], codserv:[…], cidade:[…]},
     ajustes:{debito, credito, itens:[{tipo, observacao, valor}]}}
    ```

    Nos grupos, `codserv` usa `codigo_principal`. Em `funil`, `equipe_identificada` conta `tipo_turma is not null`, `codigo_no_contrato` conta `situacao<>'FORA_CONTRATO'` e `valor_confere` conta `situacao_calculo='OK'`. Todos em serviços.
  - `neo_fat_painel() returns jsonb`: um array de `dados` de todas as faturas, ordenado por `fim desc`. Antes de devolver, recalcula as faturas sem totais ou com `calculado_em < importado_em`, ou com alguma revisão (`neo_fat_conferencias_servico.data`) posterior a `calculado_em`, ou ainda com `neo_fat_contrato_historico.data` posterior a `calculado_em`.
  - `neo_fat_conferir_servico` e `neo_fat_desconferir_servico` (recriadas aqui com `create or replace`) chamam `neo_fat_atualizar_totais(p_fatura)` no fim.

- [ ] **Step 1: Add failing assertions:**

```js
const [p]=await t`select neo_fat_painel() d`;
const f=p.d.find(x=>x.fatura==='9844');
assert.equal(f.servicos,21910);assert.equal(f.linhas,27389);
assert.equal(Number(f.creditado).toFixed(6),'917.112183');
assert.equal(Number(f.multas).toFixed(6),'21.226389');
assert.equal(Number(f.ajustes.debito).toFixed(6),'64.963712');
assert.equal(Number(f.ajustes.credito).toFixed(6),'95.344853');
assert.equal(f.funil.importados,21910);
const [sv]=await t`select coalesce(sum(devido-creditado),0) us from neo_fat_servicos where fatura='9844' and situacao='A_MENOS'`;
assert.equal(Number(f.saldo_a_receber).toFixed(6),Number(sv.us).toFixed(6));
// desatualização: reimportação simulada
await t`update neo_fat_faturas set importado_em=now()+interval '1 minute' where id='9844'`;
const [antes]=await t`select calculado_em from neo_fat_totais where fatura='9844'`;
await t`select neo_fat_painel()`;
const [depois]=await t`select calculado_em from neo_fat_totais where fatura='9844'`;
assert.ok(depois.calculado_em>antes.calculado_em);
// conferir atualiza o saldo
const alvo=(await t`select numserv,devido-creditado d from neo_fat_servicos where fatura='9844' and situacao='A_MENOS' limit 1`)[0];
await t`select neo_fat_conferir_servico('9844',${alvo.numserv},'aceito pela equipe')`;
const [p2]=await t`select dados from neo_fat_totais where fatura='9844'`;
assert.equal((Number(f.saldo_a_receber)-Number(p2.dados.saldo_a_receber)).toFixed(6),Number(alvo.d).toFixed(6));
```

- [ ] **Step 2: Run.** Expected: FAIL com `function neo_fat_painel() does not exist`.
- [ ] **Step 3: Implement migration 030.**
- [ ] **Step 4:** dry-run, aplicar e rodar o teste. Expected: PASS. Registrar o tempo de `neo_fat_painel()` com os totais já em cache (o alvo é menos de 300 ms).
- [ ] **Step 5: Commit** `feat(faturamento): guarda totais por fatura para abrir rápido`.

---

### Task 4: Biblioteca de serviços, textos e resumo (TS puro)

**Files:**
- Create: `src/lib/faturamentoServicos.ts`
- Create: `src/lib/faturamentoTexto.ts`
- Create: `scripts/faturamento-texto-testar.cjs`

**Interfaces:**
- Consumes: as RPCs das Tasks 1–3.
- Produces, em `faturamentoServicos.ts`:
  - `interface ServicoFat`: as colunas da view (Task 1), com números como `number`.
  - `interface LinhaServicoFat`: o retorno de `neo_fat_servico_linhas`.
  - `interface TotaisFat`: o formato `dados` da Task 3.
  - `type LadoFat = 'a_menos'|'a_mais'|'todos'`.
  - `interface LadoResumoFat {us:number; servicos:number; por_motivo:Record<string,{us:number;servicos:number}>}` e `interface LadosFat {a_menos:LadoResumoFat; a_mais:LadoResumoFat}`.
  - `listarServicosFat(filtros: Record<string,string>, pagina: number, limite = 50): Promise<{total:number; servicos:ServicoFat[]; lados:LadosFat}>`.
  - `linhasServicoFat(fatura: string, numserv: string): Promise<LinhaServicoFat[]>`.
  - `conferirServicoFat(fatura: string, numserv: string, observacao: string): Promise<void>` e `desconferirServicoFat(fatura: string, numserv: string): Promise<void>`.
  - `painelFat(): Promise<TotaisFat[]>`.
  - `exportarNegociacaoFat(fatura: string): Promise<void>`: percorre `listarServicosFat` com limite 1000 para `a_menos` e `a_mais` e grava um XLSX `negociacao-fatura-<fatura>.xlsx` com as abas "Pagou a menos" e "Pagou a mais". Colunas: Serviço, Códigos, Equipe, Frota, Cidade, Deveria (US), Pagou (US), Diferença (US), Motivo, Explicação.
- Produces, em `faturamentoTexto.ts` (puro, sem Supabase):
  - `MOTIVOS_FAT: Record<string,string>` = `{MOTO_INDEVIDO:'Desconto de Moto indevido', RC_NAO_PAGO:'RC não pago', FATOR_MENOR:'Fator menor que o contrato', RC_VARIAS_LINHAS:'RC pago em várias linhas', FATOR_MAIOR:'Fator maior que o contrato', OUTRA:'Outra diferença'}`.
  - `SITUACOES_SERVICO_FAT: Record<string,string>` = `{OK:'Confere', A_MENOS:'Pagou a menos', A_MAIS:'Pagou a mais', FORA_CONTRATO:'Código fora do contrato', CONFERIDO:'Conferido'}`.
  - `fraseServico(s: Pick<ServicoFat,'situacao_calculo'|'motivo'|'devido'|'creditado'|'codigo_principal'|'tipo_turma'|'fator_aplicado'|'moto'|'rc_por_atendimento'|'qtd_linhas'|'parcial'>): string`.
  - `notaCalculo(s: same Pick, codigos: string[]): string`: a nota curta da janela modal.
  - `somarTotais(lista: TotaisFat[]): TotaisFat`: soma os campos numéricos e mescla `grupos` por `valor` e `por_motivo` por chave. `fatura` = lista de números separados por ", ". Serve para o Resumo por período.
  - `variacao(atual: number, anterior: number): number|null`: percentual, null se `anterior` for 0.

- [ ] **Step 1: Write the failing test** `scripts/faturamento-texto-testar.cjs`, carregando `.ts` como em `faturamento-planilhas-testar.cjs`:

```js
const {fraseServico,notaCalculo,somarTotais,variacao,MOTIVOS_FAT}=require('../src/lib/faturamentoTexto.ts');
const base={situacao_calculo:'A_MENOS',devido:0.0234,creditado:0.0164,codigo_principal:'5.14',tipo_turma:'D',fator_aplicado:'CSC',moto:false,rc_por_atendimento:false,qtd_linhas:1,parcial:false};
assert.equal(fraseServico({...base,motivo:'MOTO_INDEVIDO'}),
 'Deveria pagar 0,023400 (5.14, fator normal) e pagou 0,016400: aplicaram o desconto de Moto 0,7 numa equipe Multifuncional.');
assert.equal(fraseServico({...base,motivo:'RC_NAO_PAGO',codigo_principal:'RC07',rc_por_atendimento:true,qtd_linhas:2,creditado:0,devido:0.0912}),
 'RC07 deveria ser pago uma vez (0,091200), mas nenhuma das 2 linhas do atendimento recebeu crédito.');
assert.equal(fraseServico({...base,situacao_calculo:'OK',motivo:null,creditado:0.0234}),'Pago conforme o contrato.');
assert.match(fraseServico({...base,motivo:'OUTRA'}),/^Deveria pagar 0,023400 .* e pagou 0,016400\.$/);
assert.equal(notaCalculo({...base,rc_por_atendimento:true,codigo_principal:'RC07'},['5.14','7.42']),
 'RC07 pago uma vez por atendimento; os códigos 5.14 e 7.42 só indicam o trabalho feito.');
assert.equal(notaCalculo({...base,qtd_linhas:2},['7.15','7.10']),'Pagamento por código: cada código (7.15 e 7.10) é pago na sua linha.');
assert.ok(fraseServico({...base,parcial:true,motivo:'OUTRA'}).endsWith(' Parte dos códigos não tem fator no contrato.'));
const t=(n,o)=>({fatura:n,linhas:1,servicos:1,creditado:o,multas:0,estorno:0,devido:o,diferenca:0,sem_fator_servicos:0,parciais:0,saldo_a_receber:o,pago_a_mais:0,
 a_menos:{servicos:1,por_motivo:{OUTRA:{us:o,servicos:1}}},a_mais:{servicos:0,por_motivo:{}},
 funil:{importados:1,equipe_identificada:1,codigo_no_contrato:1,valor_confere:0,conferidos:0},
 grupos:{tipo_turma:[{valor:'M',servicos:1,creditado:o,devido:o,multas:0}],codserv:[],cidade:[]},ajustes:{debito:0,credito:0,itens:[]}});
const s=somarTotais([t('9799',1),t('9844',2)]);
assert.equal(s.saldo_a_receber,3);assert.equal(s.a_menos.por_motivo.OUTRA.servicos,2);
assert.deepEqual(s.grupos.tipo_turma,[{valor:'M',servicos:2,creditado:3,devido:3,multas:0}]);
assert.equal(variacao(903.33,871.05).toFixed(1),'3.7');assert.equal(variacao(1,0),null);
assert.equal(Object.keys(MOTIVOS_FAT).length,6);
console.log('OK: textos e soma de totais.');
```

  Os nomes de equipe vêm de `TIPOS_TURMA_FAT` (`src/lib/faturamentoPlanilhas.ts`), em que D = Multifuncional. Os valores usam `usFat`, com seis casas e vírgula.

- [ ] **Step 2: Run** `node scripts/faturamento-texto-testar.cjs`. Expected: FAIL com `Cannot find module '../src/lib/faturamentoTexto.ts'`.
- [ ] **Step 3: Implement the two files.** `faturamentoTexto.ts` não pode importar `supabase` (o teste roda sem `.env` do Vite). `usFat` pode ser copiada ou extraída para um módulo sem efeitos colaterais.
- [ ] **Step 4: Run** o teste e `npm run typecheck`. Expected: PASS e zero erros.
- [ ] **Step 5: Commit** `feat(faturamento): textos e consultas da conferência por serviço`.

---

### Task 5: Cache dos últimos dados e animação de carregamento

**Files:**
- Create: `src/lib/cacheTela.ts`
- Create: `src/components/faturamento/CarregandoNeo.tsx`
- Modify: `scripts/faturamento-texto-testar.cjs`

**Interfaces:**
- Produces:
  - `lerCache<T>(chave: string, armazenamento?: Pick<Storage,'getItem'>): {dados:T; salvoEm:number}|null` e `gravarCache<T>(chave: string, dados: T, armazenamento?: Pick<Storage,'setItem'>): void`. O padrão é `localStorage`, com prefixo `neo-fat:`. Toda exceção é engolida (retorna null ou não faz nada).
  - `useDadosComCache<T>(chave: string, carregar: () => Promise<T>, deps: unknown[]): {dados:T|null; erro:string; atualizando:boolean; salvoEm:number|null; recarregar:()=>void}`. Mostra o cache na hora, chama `carregar` e grava o resultado. Em erro, mantém os dados do cache.
  - `tempoRelativo(ms: number, agora?: number): string`, que devolve "agora", "há 2 min", "há 3 h" ou "há 2 dias".
  - `<CarregandoNeo variante="lista"|"resumo"|"conferencia" />`: o esqueleto da tela (blocos `bg-linha/60 animate-pulse` no formato dos cartões) e, no centro, o anel da marca girando (reaproveitar `NeoLogo`, ou o anel de `CircuitoAnimado`). Usa `aria-busy` e `role="status"` com o texto oculto "Carregando dados do faturamento".

- [ ] **Step 1: Add failing assertions** to `faturamento-texto-testar.cjs`:

```js
const {lerCache,gravarCache,tempoRelativo}=require('../src/lib/cacheTela.ts');
const mem=new Map(),arm={getItem:k=>mem.get(k)??null,setItem:(k,v)=>mem.set(k,v)};
gravarCache('painel',{a:1},arm);assert.deepEqual(lerCache('painel',arm).dados,{a:1});
const quebrado={getItem(){throw new Error('bloqueado')},setItem(){throw new Error('bloqueado')}};
assert.equal(lerCache('painel',quebrado),null);assert.doesNotThrow(()=>gravarCache('painel',{a:1},quebrado));
mem.set('neo-fat:ruim','{nao json');assert.equal(lerCache('ruim',arm),null);
assert.equal(tempoRelativo(0,30_000),'agora');assert.equal(tempoRelativo(0,120_000),'há 2 min');
assert.equal(tempoRelativo(0,3*3600_000),'há 3 h');
```

- [ ] **Step 2: Run.** Expected: FAIL com `Cannot find module '../src/lib/cacheTela.ts'`.
- [ ] **Step 3: Implement.** `cacheTela.ts` só importa `react` dentro do hook. Para o teste transpilar sem React, coloque o hook em `src/lib/useDadosComCache.ts`, que importa `cacheTela.ts`.
- [ ] **Step 4: Run** o teste e `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(faturamento): abre telas com os últimos dados e carregamento animado`.

---

### Task 6: Componentes compartilhados de Faturamento

**Files** (todos novos):
- `src/components/faturamento/JanelaModal.tsx`
- `src/components/faturamento/CabecalhoFatura.tsx`
- `src/components/faturamento/SeletorPeriodo.tsx`
- `src/components/faturamento/GraficoFaturas.tsx`
- `src/components/faturamento/FunilConferencia.tsx`
- `src/components/faturamento/MiniBarras.tsx`
- `src/components/faturamento/AjudaFat.tsx`

**Interfaces:**
- Consumes: `TotaisFat`, `tempoRelativo`.
- Produces:
  - **`<JanelaModal aberta titulo onFechar rodape? largura?="md"|"lg" children />`**
    - Fica centralizada, com overlay `bg-noite/60`.
    - Fecha pelo "X" (`aria-label="Fechar"`), pelo botão "Cancelar" do rodapé padrão, pela tecla Esc e pelo clique no overlay.
    - Prende o foco dentro e o devolve ao elemento de origem ao fechar.
    - Usa `role="dialog" aria-modal="true" aria-labelledby`.
    - Bloqueia a rolagem do `body`.
    - No celular ocupa a largura toda, com `max-h-[90vh]` e rolagem interna.
  - **`<CabecalhoFatura faturas: {id:string; inicio:string; fim:string}[] fatura: string|null periodo: {de:string; ate:string} onFatura(id|null) onPeriodo({de,ate}) salvoEm: number|null atualizando: boolean onRecarregar() acoes?: ReactNode rotulo: string />`**
    - Renderiza a frase "Fatura **9844 ▾** · **jul – set / 2026 ▾**". As partes clicáveis são `button` com sublinhado tracejado `border-sinal`.
    - O seletor de fatura é uma lista com "Todas as faturas" no topo.
    - Ao lado aparece "atualizado há X min ⟳".
  - **`<SeletorPeriodo de ate onChange />`**: um popover com os atalhos "Este mês", "3 meses", "6 meses" e "Ano" (controle segmentado) e uma grade de 12 meses com setas de ano. O clique em dois meses define o intervalo, de `01/MM` até o último dia do mês final. Fecha com Esc ou com clique fora.
  - **`<GraficoFaturas itens: {fatura:string; pago:number; devido:number; multas:number}[] destaque?: string />`**: barras agrupadas em `div` com flex. A altura é proporcional ao maior valor. A legenda fica no topo à direita, em `text-[11px]`, e os rótulos do eixo X em `font-codigo text-[11px]`, com o destaque em `text-sm font-bold`. Cada grupo tem `title` com os valores.
  - **`<FunilConferencia funil: TotaisFat['funil'] onEtapa?(etapa: 'fora_contrato'|'divergente') />`**
    - Funil F1 centralizado e compacto: barras de 22 px, larguras de 100% a 76% em degraus fixos e rótulos à esquerda (`w-[110px]`).
    - À direita de cada etapa fica a perda: `−N fora` em `text-pendente` e `−N diverg.` em `text-erro`.
    - Embaixo, "X% conferem sem intervenção".
    - A etapa "Equipe identificada" só mostra perda se ela for maior que 0.
  - **`<MiniBarras pago devido multas />`**: as três barrinhas da lista de faturas.
  - **`<AjudaFat tema: string />`**: um "?" redondo que leva para `/faturamento/documentacao#<tema>`.
  - **`<RodapeFat />`**: o link "Documentação · como funciona o faturamento", dentro de `AjudaFat.tsx`.

- [ ] **Step 1:** Implemente os componentes e rode `npm run typecheck`. Expected: zero erros. O comportamento é testado na Task 12 (UI), porque o projeto não tem um runner de componentes.
- [ ] **Step 2: Commit** `feat(faturamento): componentes de cabeçalho, janela e gráficos`.

---

### Task 7: Lista de faturas, rotas e sidebar

**Files:**
- Create: `src/paginas/faturamento/Faturas.tsx`
- Modify: `src/App.tsx:28-31,124-129`
- Modify: `src/components/Shell.tsx:55-62`

**Interfaces:**
- Consumes: `painelFat`, `useDadosComCache`, `GraficoFaturas`, `MiniBarras`, `CarregandoNeo`, `variacao`.
- Produces, as rotas:
  - `/faturamento` → `Faturas`;
  - `/faturamento/resumo` → Resumo;
  - `/faturamento/conferencia` → Conferência;
  - `/faturamento/importar`, `/faturamento/tabelas` (sem mudança);
  - `/faturamento/documentacao` → Documentação.
  - Redirecionamento: `/faturamento?fatura=X…` (com qualquer query que não seja vazia) → `/faturamento/conferencia?<mesma query>`. Isso é implementado dentro de `Faturas`, com `Navigate replace` quando `searchParams` tem `fatura`, `situacao` ou `q`.
  - Sidebar: Faturas (`/faturamento`, `fim: true`), Resumo, Conferência, Importar fatura e Tabelas do contrato. A Documentação não aparece.

- [ ] **Step 1: Implement `Faturas.tsx`** conforme o mockup `.superpowers/brainstorm/1447-1793011880/content/lista-faturas-v3.html`.
  - No topo, três cartões com uma linha de tendência em SVG (`polyline`, sem texto dentro do SVG):
    - Pago pela CEMIG = Σ `creditado`, com o texto "+X% na <atual> contra a <anterior>";
    - Pago a menos = Σ `saldo_a_receber`, com o texto "maior saldo: <fatura> (<valor>)";
    - Multas aplicadas = Σ `multas`, com o texto "média de X% do pago".
  - Depois vem o `GraficoFaturas` e a fatura atual (primeira de `painelFat`) em destaque, com o selo "Atual".
  - Por fim, "Histórico". Cada item mostra `MiniBarras`, % conferem (`valor_confere/servicos`), uma barrinha empilhada e o saldo a receber. O clique leva para `/faturamento/resumo?fatura=<id>`.
  - Estado vazio: "Nenhuma fatura importada ainda." com o botão "Importar a primeira fatura".
  - Botão "＋ Importar nova fatura" no topo. `<RodapeFat />` no fim.
- [ ] **Step 2: Update routes and Shell**, depois rode `npm run typecheck` e `npm run build`. Expected: build OK.
- [ ] **Step 3: Commit** `feat(faturamento): lista de faturas como entrada`.

---

### Task 8: Resumo redesenhado

**Files:**
- Modify (reescrever): `src/paginas/faturamento/Resumo.tsx`
- Create: `src/components/faturamento/AlternarFatura.tsx` (a chave "Resumo | Conferência", também usada pela Task 9)

**Interfaces:**
- Consumes: `painelFat`, `somarTotais`, `CabecalhoFatura`, `FunilConferencia`, `GraficoFaturas`, `useDadosComCache`.
- Produces: `<AlternarFatura atual: 'resumo'|'conferencia' />`. Ele preserva a query `fatura`, `de` e `ate`.

- [ ] **Step 1: Implement** conforme `resumo-final.html`.
  - Os dados vêm de `painelFat()`, que já é rápido, filtrados em memória:
    - `?fatura=X` mostra só aquela fatura;
    - sem fatura, mostra `somarTotais` das faturas cujo `[inicio,fim]` cruza `[de,ate]`;
    - sem período, o padrão é "3 meses" até o `fim` mais recente.
  - **Manchete** em `bg-noite`:
    - rótulo "Diferença · pago − devido";
    - valor em `text-sinal-claro font-codigo text-4xl`, com sinal;
    - frase "A CEMIG pagou {creditado} e o contrato prevê {devido}.";
    - aviso "⚠ {sem_fator_servicos} serviços sem fator no contrato ficaram de fora do devido", quando maior que 0.
  - **Três cartões de apoio:**
    - Serviços analisados ({linhas} linhas);
    - US pagos (crédito · estorno);
    - Multas (glosas) em vermelho.
  - **Linha dupla:** à esquerda (`lg:grid-cols-[1fr_1.5fr]`) o `FunilConferencia`, cujas etapas levam para a Conferência com o filtro equivalente. À direita, o `GraficoFaturas` com todas as faturas e a atual em destaque.
  - **Grupos:** três listas (tipo de equipe, código e cidade), com os 6 primeiros e "ver todos", que expande ali mesmo. O clique leva para a Conferência filtrada.
  - **Ajustes:** tabela, com o total de débito e crédito no título.
  - Usar `AlternarFatura` e `AjudaFat tema="resumo"`. Remover os `<input type="date">`.
- [ ] **Step 2:** `npm run typecheck && npm run build`. Expected: OK.
- [ ] **Step 3: Commit** `feat(faturamento): resumo com manchete, funil e comparação`.

---

### Task 9: Conferência por serviço (modelo A) e janela de detalhe

**Files:**
- Modify (reescrever): `src/paginas/faturamento/Conferencia.tsx`
- Create: `src/paginas/faturamento/DetalheServico.tsx`
- Modify: `src/lib/faturamento.ts`. Manter `linhasFat`, `exportarFat` e `conferirFat` enquanto houver uso. Ao fim desta task, remova o que ficar sem chamador (`graft callers` antes).

**Interfaces:**
- Consumes: `listarServicosFat`, `linhasServicoFat`, `conferirServicoFat`, `desconferirServicoFat`, `exportarNegociacaoFat`, `fraseServico`, `notaCalculo`, `MOTIVOS_FAT`, `SITUACOES_SERVICO_FAT`, `JanelaModal`, `CabecalhoFatura`, `AlternarFatura`.
- Produces: `<DetalheServico servico: ServicoFat aberto onFechar onAlterado />`.

- [ ] **Step 1: Implement `Conferencia.tsx`** conforme `conferencia-layout.html`, opção A.
  - Os estados de URL são `fatura`, `lado` (padrão `a_menos`), `motivo`, `conferidos`, `visao` (`negociar` ou `todos`) e os filtros de `todos`.
  - **Visão `negociar`:**
    - Grade `lg:grid-cols-[2fr_1fr]`.
    - **Cartão principal** com borda `border-erro`:
      - "A receber · pagou a menos", com `lados.a_menos.us` em `text-erro font-codigo text-3xl`;
      - "em N serviços";
      - chips "Todos N" mais um chip por motivo de `por_motivo`, ordenados por US;
      - lista paginada de 50 com: número em `font-codigo`, código principal, equipe, cidade, diferença em vermelho e `fraseServico` embaixo;
      - "Carregar mais" no fim.
    - **Lateral** "Pagou a mais": total, número de serviços, uma linha por motivo (clicável, troca `lado`) e o texto "Pode vir a ser cobrado pela CEMIG depois.".
    - No topo, os botões "Ver todos os serviços" (`visao=todos`) e "⬇ Exportar para negociação".
    - Um chip "Conferidos (N)" alterna `conferidos=somente`.
  - **Visão `todos`:** tabela por serviço com as colunas Serviço, Equipe/frota, Códigos, Deveria, Pagou, Diferença e Situação (`SITUACOES_SERVICO_FAT`, com selo colorido). Filtros: situação, equipe, código, cidade e busca por número, todos como `select`/`input` com rótulo visível. Paginação de 50.
  - O clique numa linha ou num item abre o `DetalheServico`. `AjudaFat tema="conferencia"`.
  - Estado vazio do lado `a_menos`: "Nada pago a menos nesta fatura. 🎉" com o link "ver todos os serviços".
- [ ] **Step 2: Implement `DetalheServico.tsx`** dentro de `JanelaModal largura="lg"`:
  - **Cabeçalho:** número, situação e motivo.
  - **Bloco "O que aconteceu":** `fraseServico` e `notaCalculo` em destaque.
  - **Equipe:** tipo, frota e turma, com a origem "Serviço da Fatura Completa × US_Turma da Fatura Resumida".
  - **Tabela das linhas** (de `linhasServicoFat`): código, tabela, urbano, rural, creditado, glosa e devido (CSC/COD/Moto).
  - **Glosas:** em separado, com a justificativa.
  - **Rodapé:**
    - campo Observação (mínimo de 3 caracteres);
    - "Marcar como conferido" (ou "Desfazer conferência", se `situacao='CONFERIDO'`);
    - "Cancelar";
    - aviso de `revisao_desatualizada`.
  - Salvar chama `onAlterado` e fecha.
- [ ] **Step 3:** `npm run typecheck && npm run build`. Expected: OK.
- [ ] **Step 4: Commit** `feat(faturamento): conferência focada no que foi pago a menos`.

---

### Task 10: Importação segura

**Files:**
- Create: `supabase/migrations/031_faturamento_hash_importacao.sql`
- Modify: `src/lib/faturamentoPlanilhas.ts` (funções puras novas)
- Modify: `src/lib/faturamento.ts` (`importarFat` registra hashes e chama `neo_fat_atualizar_totais`)
- Modify: `src/paginas/faturamento/Importar.tsx`
- Modify: `scripts/faturamento-planilhas-testar.cjs`

**Interfaces:**
- Produces:
  - Migration 031:
    - `alter table neo_fat_faturas add column hash_resumida text, add column hash_completa text`;
    - `neo_fat_registrar_hashes(p_fatura text, p_hash_resumida text, p_hash_completa text) returns void`;
    - `neo_fat_faturas` passa a expor os hashes em `faturasFat()`, que já faz `select *`.
  - Em `faturamentoPlanilhas.ts`:
    - `hashArquivo(buffer: ArrayBuffer): Promise<string>`: SHA-256 em hex via `crypto.subtle`, disponível no Node 20 como `globalThis.crypto`;
    - `linhasDuplicadas(linhas: RegistroFat[]): RegistroFat[][]`: grupos de 2 ou mais linhas idênticas em todos os campos (chave = JSON com as chaves ordenadas);
    - `resumoImportacao(l: LeituraFat, c: LeituraCompletaFat): {linhas:number; servicos:number; creditado:number; multas:number}`.

- [ ] **Step 1: Add failing assertions** to `faturamento-planilhas-testar.cjs`:

```js
const {hashArquivo,linhasDuplicadas,resumoImportacao}=require('../src/lib/faturamentoPlanilhas.ts');
const buf=fs.readFileSync(path.join(dir,nomes.find(n=>n.startsWith('Resumo_Fat_9844'))));
const h1=await hashArquivo(buf),h2=await hashArquivo(buf);assert.equal(h1,h2);assert.match(h1,/^[0-9a-f]{64}$/);
assert.notEqual(await hashArquivo(Buffer.concat([buf,Buffer.from([0])])),h1);
assert.deepEqual(linhasDuplicadas([{a:1,b:2},{b:2,a:1},{a:1,b:3}]).map(g=>g.length),[2]);
assert.deepEqual(linhasDuplicadas([{numserv:'1',codserv:'7.15'},{numserv:'1',codserv:'7.10'}]),[]);
const r=resumoImportacao(resumida,completa);
assert.equal(r.linhas,27389);assert.equal(r.servicos,21910);assert.equal(r.creditado.toFixed(6),'917.112183');assert.equal(r.multas.toFixed(6),'21.226389');
console.log('Duplicadas na 9844:',linhasDuplicadas(resumida.abas.US_Servico).length,'grupos');
```

  O script atual é síncrono: envolva as asserções novas num `(async()=>{…})()`.

- [ ] **Step 2: Run** `node scripts/faturamento-planilhas-testar.cjs`. Expected: FAIL com `hashArquivo is not a function`.
- [ ] **Step 3: Implement** as funções puras e a migration 031 (dry-run, depois aplicar). Em `importarFat`, depois de `neo_fat_finalizar_completa`, chamar `neo_fat_registrar_hashes` e depois `neo_fat_atualizar_totais`.
- [ ] **Step 4: Update `Importar.tsx`.** Manter o fluxo atual de prévia, progresso e publicação atômica, e acrescentar:
  - Ao ler os dois arquivos, calcular os hashes. Se a fatura existe e os dois hashes são iguais aos guardados, mostrar o aviso `concluido`: "Estes arquivos são idênticos aos já importados da fatura X. Nada mudou." e desabilitar o botão.
  - Se a fatura existe e algo mudou, o botão vira "Revisar e substituir…", que abre uma `JanelaModal` com:
    - uma tabela "Antes → Depois", com linhas, serviços, crédito e multas (antes = `painelFat()` daquela fatura, depois = `resumoImportacao`);
    - a frase "{conferidos} serviços conferidos serão reabertos se os dados deles mudarem.";
    - um campo "Digite o número da fatura para confirmar", e o botão "Substituir fatura" só habilita com o número exato;
    - "Cancelar".
  - Se `linhasDuplicadas(US_Servico).length > 0`, mostrar na prévia um bloco `pendente` com "N grupos de linhas idênticas", a lista expansível (numserv, codserv, crédito) e a frase "Confira com a CEMIG antes de importar.". Isso é um aviso, não um bloqueio.
  - A trava de faturas diferentes (`cruzarFaturas`) já existe: deixar a mensagem dela visível como erro.
- [ ] **Step 5: Run** o teste, `npm run typecheck` e `npm run build`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(faturamento): importação confirma substituição e detecta duplicidade`.

---

### Task 11: Tabelas do contrato (Moto) e Documentação

**Files:**
- Modify: `src/paginas/faturamento/Contrato.tsx`
- Create: `src/lib/faturamentoMoto.ts`
- Create: `src/paginas/faturamento/Documentacao.tsx`
- Modify: `scripts/faturamento-texto-testar.cjs`

**Interfaces:**
- Produces:
  - `valorMoto(c: Pick<ContratoFat,'tabela'|'moto'|'fator_csc'|'fator_cod'>, motoUrbano: number): {fator:number|null; csc:number|null; cod:number|null; semDesconto:boolean; naoPaga:boolean}`. A regra é a mesma da parte urbana de migration 023:
    - Tabela 11 com `moto='1'`: fator 1, os mesmos valores e `semDesconto`;
    - Tabela 11 com `moto='0'`: `naoPaga`, com valores null;
    - qualquer outro caso, inclusive a Tabela 12 e `moto` '0,7' ou null: `motoUrbano` (de `neo_fat_config`).
  - `configFat(): Promise<{moto_urbano:number}>`, em `faturamento.ts`, lendo `neo_fat_config`. Antes de implementar, confira se o `select` funciona para um usuário autenticado comum. Se não funcionar, crie em 031 a RPC `neo_fat_config_publica()`.

- [ ] **Step 1: Add failing assertions:**

```js
const {valorMoto}=require('../src/lib/faturamentoMoto.ts');
assert.deepEqual(valorMoto({tabela:'11',moto:'1',fator_csc:0.0234,fator_cod:0.03},0.7),{fator:1,csc:0.0234,cod:0.03,semDesconto:true,naoPaga:false});
assert.deepEqual(valorMoto({tabela:'11',moto:'0',fator_csc:0.0234,fator_cod:0.03},0.7),{fator:0,csc:null,cod:null,semDesconto:false,naoPaga:true});
const v=valorMoto({tabela:'11',moto:'0,7',fator_csc:0.0234,fator_cod:null},0.7);
assert.equal(v.fator,0.7);assert.equal(v.csc.toFixed(6),'0.016380');assert.equal(v.cod,null);
assert.equal(valorMoto({tabela:'12',moto:null,fator_csc:0.0912,fator_cod:0.1},0.7).fator,0.7);
```

- [ ] **Step 2: Run.** Expected: FAIL com `Cannot find module '../src/lib/faturamentoMoto.ts'`.
- [ ] **Step 3: Implement `valorMoto` e as colunas no `Contrato.tsx`.**
  - Ordem das colunas: Tabela, Código, Descrição, CSC/CSI, COD, **Fator Moto**, **Valor Moto**, Validação.
  - Valor Moto: CSC e COD empilhados em `font-codigo`. Selo `sinal` "sem desconto" quando `semDesconto`; texto `aco` "não paga Moto" quando `naoPaga`.
  - O rural não aparece. No canto superior direito do cabeçalho, o link "Documentação" para `/faturamento/documentacao#contrato`.
  - Trocar "Carregando…" por `CarregandoNeo` e acrescentar `RodapeFat`.
- [ ] **Step 4: Implement `Documentacao.tsx`** conforme `documentacao.html`. O conteúdo fica num array tipado `TEMAS: {id:string; pergunta:string; resposta:string; exemplo?:ReactNode; detalhes?:ReactNode}[]`, no próprio arquivo.
  - **Topo:** "Em 1 minuto", com os cinco ícones `lucide-react`.
  - **Busca:** filtra por `pergunta` e `resposta`, sem diferenciar acentos (`normalize('NFD')`).
  - **Comportamento dos temas:** a âncora `#id` abre e rola até o tema; "ver detalhes" usa `<details>`.
  - **Temas obrigatórios, com os ids que os `AjudaFat` usam:**
    - `inicio` (Em 1 minuto);
    - `planilhas` (por que duas planilhas, e 27.389 linhas × 21.910 serviços);
    - `rc-codigo`, com os exemplos 242861522 NSSR 7.15/7.10 e 245530193 RC07 5.14/7.42 como no mockup;
    - `moto`;
    - `saldo` (a receber × a mais; multas fora; conferidos saem);
    - `funil` (`resumo` também aponta para cá);
    - `conferencia` (como ler a tela e conferir um serviço);
    - `importar` (substituição, arquivo idêntico, duplicidade);
    - `contrato` (o que são as Tabelas 11 e 12);
    - `glossario` (US, glosa, estorno, CSC/CSI, COD, RC, Tabela 11/12, frota, turma).
  - **Texto:** cada `resposta` com no máximo 2 frases, em português simples.
- [ ] **Step 5: Run** o teste, `npm run typecheck` e `npm run build`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(faturamento): fator Moto no contrato e página de documentação`.

---

### Task 12: Teste de interface, verificação final e memória

**Files:**
- Modify: `scripts/faturamento-ui-testar.cjs`
- Modify: `MEMORIA_COMPARTILHADA.md`, `docs/faturamento-relatorio.md`, `docs/faturamento-checklist-auditoria.md`

- [ ] **Step 1: Atualizar o teste de UI.** Interceptar as RPCs novas (`neo_fat_painel`, `neo_fat_servicos_listar`, `neo_fat_servico_linhas`, `neo_fat_conferir_servico`, `neo_fat_registrar_hashes`, `neo_fat_atualizar_totais`), com respostas lidas do banco real na preparação, como o script já faz. Asserções:
  - `/faturamento` mostra "Faturas da CEMIG", 3 cartões e a fatura 9844 com "Atual".
  - Com `neo_fat_painel` → `[]`, aparece "Nenhuma fatura importada ainda.".
  - `/faturamento/resumo?fatura=9844` não tem nenhum `input[type=date]` (`page.locator('input[type=date]').count()` = 0) e tem a legenda "Pago" com `font-size` computado ≤ 12 px.
  - `/faturamento/conferencia?fatura=9844`:
    - o clique no primeiro item abre `role=dialog`;
    - `Escape` fecha;
    - reabrir e clicar em "Cancelar" fecha;
    - reabrir e clicar em `aria-label=Fechar` fecha.
  - Conferência com `lados.a_menos.servicos=0` mostra "Nada pago a menos nesta fatura.".
  - `/faturamento?fatura=9844` redireciona para `/faturamento/conferencia?fatura=9844`.
  - Importar os mesmos dois arquivos de `Comparação de fatura/`, com os hashes interceptados iguais, mostra "Nada mudou". Com hashes diferentes, abre a janela "Digite o número da fatura", e "Substituir fatura" fica desabilitado até digitar `9844`.
  - Exportar para negociação, com `neo_fat_servicos_listar` interceptado devolvendo `total: 1500`: registrar as chamadas e confirmar `offset` 0 e 1000 para cada lado e um download `negociacao-fatura-9844.xlsx`.
  - Tabelas: a linha `6.01` mostra "sem desconto".
  - `/faturamento/documentacao#rc-codigo` mostra "245530193".
  - Em viewport 390×844, nas rotas acima, `document.documentElement.scrollWidth <= innerWidth`.
  - Salvar capturas em `.tmp-faturamento/` (desktop e celular) e inspecioná-las.
- [ ] **Step 2: Run.** Com `npm run dev` em segundo plano, rode `node scripts/faturamento-ui-testar.cjs`. Expected: todas as asserções passam. Abra as capturas e compare com os mockups.
- [ ] **Step 3: Rodar toda a verificação:**
  - `npm run typecheck`
  - `npm run build`
  - `node scripts/faturamento-planilhas-testar.cjs`
  - `node scripts/faturamento-texto-testar.cjs`
  - `node scripts/faturamento-servicos-testar.cjs`
  - `node scripts/faturamento-conferencia-testar.cjs`
  - `node scripts/faturamento-testar.cjs`
  - `node scripts/faturamento-duas-planilhas-testar.cjs`

  Expected: tudo PASS. Se algum script antigo falhar por causa da mudança de modelo (por exemplo as contagens de `REVISAR_RC_MULTILINHA`), ajuste a asserção para o novo valor e registre o porquê. A view por linha não pode ser quebrada.
- [ ] **Step 4: Atualizar a memória e o relatório** com:
  - modelo por serviço;
  - definição de saldo, multas e conferidos;
  - novas rotas;
  - migrations 028–031 aplicadas;
  - devido por serviço × 857,921936 (número da Task 1);
  - distribuição dos motivos;
  - tempos medidos;
  - pendências: motivos `OUTRA`, regras de negócio abertas;
  - deploy não verificado, se for o caso.
- [ ] **Step 5: Commit** `docs(faturamento): registra conferência por serviço e novo visual`.
