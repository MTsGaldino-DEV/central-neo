# Duplicidade de NSMP/NSPR/NSMC na fila — plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** linha amarela na fila quando NSMP/NSPR/NSMC está em outro serviço, e confirmação antes de gravar um número repetido.

**Architecture:** funções em `src/lib/fechamentoDuplicidade.ts` consultam `neo_nsis_itens` com `neo_nsis!inner(tipo_serv)`; a fila chama a da página, os formulários chamam a de conferência antes de gravar.

**Tech Stack:** React + TypeScript + supabase-js; teste de UI em Playwright com Supabase simulado (padrão `scripts/*-ui-testar.cjs`).

**Spec:** `docs/superpowers/specs/2026-11-25-fila-duplicidade-design.md`

## Global Constraints

- Sem migration. Comparação exata após `trim()`. Mesmo tipo com mesmo tipo; nunca o próprio serviço.
- Aviso: `confirm` nativo; cancelar não grava.
- Falha da consulta na lista: a lista aparece sem o amarelo.

## Review Focus

- NSRI com NSMC gravada em `nsmp` e `nspr`: não pode se marcar sozinha nem marcar NSPR de NSIS.
- Correção sem mudar o número: não pede confirmação se o número já era deste serviço.
- Vários números na mesma linha (histórico com 2 NSMPs): cada um conferido.
- Página vazia ou sem números: nenhuma consulta.
- Número só com espaços: tratado como vazio (as validações existentes recusam).

---

### Task 1: biblioteca de duplicidade

**Files:** Create `src/lib/fechamentoDuplicidade.ts`

**Interfaces (Produces):**
- `type TipoNumero = 'NSMP' | 'NSPR' | 'NSMC'`
- `interface Repeticao { tipo: TipoNumero; numero: string; servicos: string[] }`
- `duplicidadesDaPagina(linhas: Nsis[]): Promise<Record<string, Repeticao[]>>` — chave = serviço da linha.
- `outrosServicosCom(tipo: TipoNumero, numero: string, servicoAtual: string): Promise<string[]>`
- `confirmarSemDuplicidade(conferir: { tipo: TipoNumero; numero: string }[], servicoAtual: string): Promise<boolean>` — chama `confirm` se achar repetição; `true` = pode gravar.
- `tipoDaPrimeiraEtapa(tipoServ: string): 'NSMP' | 'NSMC'`

- [ ] Implementar; `typecheck` passa.

### Task 2: linha amarela na fila

**Files:** Modify `src/paginas/fechamento/Fila.tsx`, `src/index.css`

- [ ] Estado `repetidos` carregado após cada página (pedido mais recente vence; erro ignorado).
- [ ] `<tr>` com classe `duplicada` e `title` "NSPR 123 também no serviço X"; célula NSMP/NSPR marca o número repetido com ⚠.
- [ ] CSS `.grade-nsis tbody tr.duplicada { background: #fef9c3 }` (selecionada continua vencendo).

### Task 3: confirmação antes de gravar

**Files:** Modify `src/paginas/fechamento/JanelaFluxo.tsx` (FormFechar.salvar, FormNspr), `src/paginas/fechamento/PainelNsis.tsx` (CampoRapido NSMP, ConfirmacaoNspr, FormEdicao)

- [ ] Antes da gravação, `if (!(await confirmarSemDuplicidade(...))) return;` (cancelar não grava nem mostra erro).

### Task 4: teste de UI + memória

**Files:** Create `scripts/fila-duplicidade-ui-testar.cjs`; Modify `MEMORIA_COMPARTILHADA.md`

- [ ] Teste: linha com NSPR repetida fica amarela e título cita o outro serviço; NSRI com NSMC igual ao próprio NSPR não fica; informar NSPR repetida abre confirm com o serviço; cancelar não faz PATCH; aceitar faz.
- [ ] `npm run typecheck`, `npm run build` e o teste passam.
- [ ] Atualizar memória compartilhada; commit com a frase fixa.
