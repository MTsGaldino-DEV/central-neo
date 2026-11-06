# Disponibilidade da frota: plano de implementação

> Execução direta nesta sessão (autorização do Matheus de 26/10/2026 para seguir planos pelo caminho recomendado).

**Objetivo:** substituir a planilha de disponibilidade por conferência (mês e dia) e painel na Central NEO.

**Arquitetura:** tabelas `neo_disp_*` com RLS; RPCs em JSON para mês e ano; regras puras em `src/lib/disponibilidadeRegras.ts`; telas em `src/paginas/disponibilidade/` com shadcn.

**Tecnologia:** React 19, Tailwind 4, shadcn (new-york), react-day-picker, Supabase.

**Desenho:** [2026-11-06-disponibilidade-design.md](../specs/2026-11-06-disponibilidade-design.md)

## Restrições globais

- Não aplicar migration no banco real. Teste de banco só em transação com `throw` no fim. Nunca rodar `migrar.cjs`.
- Sem FK para tabelas existentes nas migrations novas, para o teste com rollback não bloquear `auth.users`.
- A instalação do shadcn não pode mudar o visual das telas atuais: conferir o `git diff` de `src/index.css`.
- Valor R$ 864 e meta R$ 30.000 vêm de `neo_disp_config`, não fixos nas telas.
- Nada de nomes ou dados de saúde da planilha em migrations, testes ou memória.

## Pontos de atenção

- Salvar falha no meio da marcação: a tela volta ao estado anterior e mostra o erro.
- Usuário sem ser admin tenta alterar a meta: a tela não oferece e a RLS recusa.
- Mês com 31 dias: o dia 31 entra na conta (erro da planilha).
- Celular: a grade rola dentro da própria caixa, sem rolagem lateral na página.
- Duas pessoas marcando: vale a última gravação.

---

### Tarefa 1: banco

**Arquivos:** `supabase/migrations/054_disponibilidade.sql`, `055_disponibilidade_historico.sql` (gerada por `.tmp-faturamento/gerar-disp-historico.py`), `scripts/disponibilidade-banco-testar.cjs`, `.tmp-faturamento/aplicar-054-055.cjs`.

**Produz:** `neo_disp_mes(p_ano int, p_mes int) -> jsonb`; `neo_disp_ano(p_ano int) -> jsonb`.

- [ ] Teste em transação desfeita: totais por mês do desenho; usuário sem módulo não lê; com módulo marca e não altera a meta; ADMIN altera; dia futuro é recusado; ocorrência sem causa é recusada.
- [ ] Escrever as migrations até o teste passar.

### Tarefa 2: shadcn

**Arquivos:** `components.json`, `src/components/ui/*`, `src/lib/utils.ts`, `src/index.css`, `package.json`.

- [ ] Instalar button, calendar, popover, select, input, sheet, toggle-group, table, card.
- [ ] Mapear os tokens do shadcn nas cores da NEO, sem regra global nova.
- [ ] `typecheck` e `build`; `faturamento-ui-testar` continua passando.

### Tarefa 3: regras e acesso a dados

**Arquivos:** `src/lib/disponibilidadeRegras.ts`, `src/lib/disponibilidade.ts`, `src/lib/neo.ts`.

**Produz:** `CAUSAS`, `ehMultavel(causa)`, `resumoPainel(...)`; `lerFrotas()`, `lerMes(ano, mes)`, `lerAno(ano)`, `lerConfig()`, `salvarMeta(valor)`, `marcar(linhas)`, `limpar(dia, frota)`.

### Tarefa 4: telas

**Arquivos:** `src/paginas/disponibilidade/{Conferencia,GradeMes,ListaDia,Motivos,HistoricoFrota,Painel}.tsx`, `disponibilidade.css`, `src/App.tsx`, `src/components/Shell.tsx`.

- [ ] Teste de interface `scripts/disponibilidade-ui-testar.cjs` (Supabase simulado): abre no mês; troca de visão; marca e limpa pela grade e pela lista; calendário; histórico da frota; painel com os totais do desenho; meta por papel; 1920, 1440 e 390 px; sem rolagem lateral; falha ao salvar desfaz a marcação.
- [ ] Implementar até passar e conferir as capturas.

### Tarefa 5: fechamento

- [ ] Atualizar `CONTEXTO_GERAL.md` e `MEMORIA_COMPARTILHADA.md`.
- [ ] `typecheck`, `build`, todos os testes novos e `sessao-aba-testar`.
- [ ] Commit local com a frase fixa, só com os arquivos desta entrega. Sem push.
