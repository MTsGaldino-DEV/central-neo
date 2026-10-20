-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 004: tabela de valores do contrato CEMIG (Anexo VI, Tabela 03)
--
-- Tabela 03 – Fatores modularizados de remuneração dos serviços de manutenção
-- em rede de distribuição desenergizada (linha morta). É a única usada no
-- fechamento de NSIS.
--
-- fator_original = valor publicado no contrato (não muda)
-- fator_us       = valor em vigor; pode ser acertado na tela "Tabela de valores"
-- Todo acerto fica em neo_contrato_historico (quem, quando, de quanto para quanto).
--
-- Regras da tabela (notas do contrato):
--   1. Remuneração = soma dos fatores das atividades envolvidas.
--   2. Substituição = 1 retirada + 1 instalação.
--   3. Abertura de dispositivo do ASTA não é paga à parte.
--   4. Área rural: acréscimo de 20% (exceto homem-hora).
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.neo_contrato_itens (
  codigo          text primary key,          -- código SAP
  tabela          text not null default '03',
  operacao        text not null,
  atividade       text not null,
  unidade         text,
  descricao       text,
  fator_original  numeric(10, 4),
  fator_us        numeric(10, 4) not null,
  ativo           boolean not null default true,
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid()
);

create table if not exists public.neo_contrato_historico (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null references public.neo_contrato_itens (codigo) on delete cascade,
  fator_anterior  numeric(10, 4),
  fator_novo      numeric(10, 4),
  motivo          text,
  alterado_por    uuid default auth.uid(),
  alterado_em     timestamptz not null default now()
);

create index if not exists idx_neo_contrato_hist_codigo on public.neo_contrato_historico (codigo, alterado_em desc);

-- O motivo do acerto viaja na própria transação (set_config), para o trigger gravar junto.
create or replace function public.neo_contrato_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.fator_us is distinct from old.fator_us then
    insert into neo_contrato_historico (codigo, fator_anterior, fator_novo, motivo, alterado_por)
    values (new.codigo, old.fator_us, new.fator_us,
            nullif(current_setting('neo.motivo_acerto', true), ''), auth.uid());
  end if;
  new.atualizado_em := now();
  new.atualizado_por := coalesce(auth.uid(), new.atualizado_por);
  return new;
end;
$$;

drop trigger if exists trg_neo_contrato_log on public.neo_contrato_itens;
create trigger trg_neo_contrato_log before update on public.neo_contrato_itens
  for each row execute function public.neo_contrato_log();

alter table public.neo_contrato_itens enable row level security;
alter table public.neo_contrato_historico enable row level security;

-- Todo mundo do fechamento consulta; só ADMIN da NEO acerta valores.
drop policy if exists neo_contrato_itens_ler on public.neo_contrato_itens;
create policy neo_contrato_itens_ler on public.neo_contrato_itens
  for select to authenticated using (neo_tem_modulo('fechamento'));

drop policy if exists neo_contrato_itens_admin on public.neo_contrato_itens;
create policy neo_contrato_itens_admin on public.neo_contrato_itens
  for all to authenticated using (neo_is_admin()) with check (neo_is_admin());

drop policy if exists neo_contrato_historico_ler on public.neo_contrato_historico;
create policy neo_contrato_historico_ler on public.neo_contrato_historico
  for select to authenticated using (neo_tem_modulo('fechamento'));

-- Acerto de valor com motivo, numa chamada só.
create or replace function public.neo_acertar_fator(p_codigo text, p_fator numeric, p_motivo text)
returns void
language plpgsql
set search_path = public
as $$
begin
  if not neo_is_admin() then
    raise exception 'Apenas administradores da Central NEO podem acertar valores do contrato.';
  end if;
  if p_fator is null or p_fator < 0 then
    raise exception 'Informe um valor válido.';
  end if;
  perform set_config('neo.motivo_acerto', coalesce(p_motivo, ''), true);
  update neo_contrato_itens set fator_us = p_fator where codigo = p_codigo;
  if not found then
    raise exception 'Código % não encontrado.', p_codigo;
  end if;
end;
$$;

-- ─── Itens de cobrança passam a guardar código, quantidade e área ────────────
-- fator_unitario é uma "foto" do valor do código no momento do pedido: se o
-- contrato for acertado depois, o que já foi pedido não muda.
alter table public.neo_nsis_itens add column if not exists quantidade numeric(10, 2) not null default 1;
alter table public.neo_nsis_itens add column if not exists rural boolean not null default false;
alter table public.neo_nsis_itens add column if not exists fator_unitario numeric(10, 4);

-- Quantas vezes cada código já foi pedido (para a tela de valores).
create or replace view public.neo_vw_contrato_itens
with (security_invoker = true)
as
select c.*,
       (c.fator_original is not null and c.fator_us <> c.fator_original) as acertado,
       (select count(*) from public.neo_nsis_itens i where i.codigo = c.codigo) as qtd_usos,
       (select max(h.alterado_em) from public.neo_contrato_historico h where h.codigo = c.codigo) as ultimo_acerto
from public.neo_contrato_itens c;

-- ─── Carga da Tabela 03 ─────────────────────────────────────────────────────
insert into public.neo_contrato_itens (codigo, operacao, atividade, unidade, fator_original, fator_us, descricao) values
('703994','Instalar','POSTE/CONTRAPOSTE ATÉ 8m MANUT','Poste',0.2310,0.2310,'Transporte do poste ou contra poste, abertura de cava, implantação/retirada, alinhamento, aprumo, aterro e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('703995','Retirar','POSTE/CONTRAPOSTE ATÉ 8m MANUT','Poste',0.1653,0.1653,'Transporte do poste ou contra poste, abertura de cava, implantação/retirada, alinhamento, aprumo, aterro e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('703996','Instalar','POSTE/CONTRAPOSTE 9m A 13m MANUT','Poste',0.8300,0.8300,'Transporte do poste ou contra poste, abertura de cava, implantação, alinhamento, aprumo, aterramento e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('703997','Retirar','POSTE/CONTRAPOSTE 9m A 13m MANUT','Poste',0.4150,0.4150,'Transporte do poste ou contra poste, abertura de cava, implantação, alinhamento, aprumo, aterramento e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('703998','Instalar','POSTE/CONTRAPOSTE ACIMA DE 13m MANUT','Poste',1.0458,1.0458,'Transporte do poste ou contra poste, abertura de cava, implantação ou retirada, alinhamento, aprumo, aterramento e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('703999','Retirar','POSTE/CONTRAPOSTE ACIMA DE 13m MANUT','Poste',0.5229,0.5229,'Transporte do poste ou contra poste, abertura de cava, implantação ou retirada, alinhamento, aprumo, aterramento e compactação em camadas de 20cm. Recompor passeio, quando necessário.'),
('704000','Instalar','APRUMAR POSTE EXISTENTE MANUT','Poste',0.1560,0.1560,'Aprumo de poste existente, envolvendo eventuais serviços em estruturas de MT e/ou BT, incluindo fixação e/ou amarrações.'),
('704001','Instalar','ESCORAR POSTE MANUT','Poste',0.4150,0.4150,'Transporte do material e realização de escora em poste avariado/abalroado contemplando, se necessário, abertura de cava, fixação, aprumo e acabamento geral.'),
('704002','Instalar','CONCRETAR BASE POSTE 300daN MANUT','Poste',0.0800,0.0800,'Preparação do concreto e concretagem da base do poste.'),
('704003','Instalar','CONCRETAR BASE POSTE 600daN MANUT','Poste',0.1500,0.1500,'Preparação do concreto e concretagem da base do poste.'),
('704004','Instalar','CONCRETAR BASE POSTE 1000daN MANUT','Poste',0.3000,0.3000,'Preparação do concreto e concretagem da base do poste.'),
('704005','Instalar','MATERIAL CONC BASE POSTE 300daN MANUT','Poste',0.0500,0.0500,'Remuneração dos materiais necessários para concretagem da base do poste.'),
('704006','Instalar','MATERIAL CONC BASE POSTE 600daN MANUT','Poste',0.1200,0.1200,'Remuneração dos materiais necessários para concretagem da base do poste.'),
('704007','Instalar','MATERIAL CONC BASE POSTE 1000daN MANUT','Poste',0.2500,0.2500,'Remuneração dos materiais necessários para concretagem da base do poste.'),
('704008','Rebaixar/Alçar','ESTRUTURA MT REBAIXAR/ALÇAR MANUT','Estrutura',0.0500,0.0500,'Rebaixar ou alçar estrutura de MT monofásica ou trifásica.'),
('704009','Instalar','ESTRUTURA MT ÍNDICE 1 OU 2 MANUT','Estrutura',0.1056,0.1056,'Instalação/retirada de estrutura completa de MT convencional ou protegida índice 1 ou 2.'),
('704010','Retirar','ESTRUTURA MT ÍNDICE 1 OU 2 MANUT','Estrutura',0.0500,0.0500,'Instalação/retirada de estrutura completa de MT convencional ou protegida índice 1 ou 2.'),
('704011','Instalar','ESTRUTURA MT ÍNDICE 3 OU 4 MANUT','Estrutura',0.3168,0.3168,'Instalação/retirada de estrutura completa de MT convencional ou protegida índice 3 ou 4.'),
('704012','Retirar','ESTRUTURA MT ÍNDICE 3 OU 4 MANUT','Estrutura',0.0700,0.0700,'Instalação/retirada de estrutura completa de MT convencional ou protegida índice 3 ou 4.'),
('704013','Substituir','CRUZETA ÍNDICE 1 OU 2 CONV/RDP MANUT','Cruzeta',0.1621,0.1621,'Substituição (retirada e instalação) de cruzeta em estruturas de índice 1 ou 2, em qualquer tipo de rede, com todas as ferragens e acessórios necessários.'),
('704014','Substituir','CRUZETA ÍNDICE 3 OU 4 CONV/RDP MANUT','Cruzeta',0.1823,0.1823,'Substituição (retirada e instalação) de cruzeta em estruturas de índice 3 ou 4, em qualquer tipo de rede, com todas as ferragens e acessórios necessários.'),
('704015','Substituir','CRUZETA EUCALIPTO 5m MANUT','Cruzeta',0.4150,0.4150,'Substituição (retirada e instalação) de cruzeta de madeira de 5 metros, em qualquer estrutura e rede, com todas as ferragens e acessórios necessários.'),
('704016','Substituir/Virar','MÃO FRANCESA/CINTA MANUT','Estrutura',0.0338,0.0338,'Substituição de mão francesa e/ou cinta, independentemente do tipo e da estrutura, incluindo o giro da estrutura, quando necessário.'),
('704017','Substituir','BRAÇO SUPORTE MT PROTEGIDA MANUT','Peça',0.1823,0.1823,'Substituição de qualquer tipo de braço de sustentação de rede de MT protegida.'),
('704018','Substituir','BRAÇO SUPORTE MT ISOLADA MANUT','Peça',0.1028,0.1028,'Substituição de braço de sustentação de rede de MT isolada.'),
('704019','Instalar','AFASTADOR DE BT/NEUTRO MANUT','Peça',0.0950,0.0950,'Instalação ou substituição de afastador de BT ou neutro, incluindo a intervenção na estrutura de BT, eventuais conexões e amarrações.'),
('704020','Substituir','BRAÇO SUPORTE BT (GPO) MANUT','Peça',0.0950,0.0950,'Substituição de braço de sustentação de rede de BT (GPO).'),
('704021','Instalar','ESTRUTURA BT CONVENCIONAL/ISOLADA','Estrutura',0.0556,0.0556,'Instalação/retirada de qualquer tipo de estrutura de BT convencional ou isolada.'),
('704022','Retirar','ESTRUTURA BT CONVENCIONAL/ISOLADA','Estrutura',0.0062,0.0062,'Instalação/retirada de qualquer tipo de estrutura de BT convencional ou isolada.'),
('704023','Instalar','CABOS MT CONV/PROTEGIDA 1F MANUT','Vão',0.1700,0.1700,'Instalação/retirada de vão de cabo(s) de MT monofásica convencional ou protegida de qualquer bitola, com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704024','Retirar','CABOS MT CONV/PROTEGIDA 1F MANUT','Vão',0.0500,0.0500,'Instalação/retirada de vão de cabo(s) de MT monofásica convencional ou protegida de qualquer bitola, com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704025','Instalar','CABOS MT CONV TODOS OU RDP <=150 3F','Vão',0.2000,0.2000,'Instalação/retirada de vão de cabos de MT trifásica convencional de qualquer bitola ou protegida até 150mm², com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704026','Retirar','CABOS MT CONV TODOS OU RDP <=150 3F','Vão',0.1000,0.1000,'Instalação/retirada de vão de cabos de MT trifásica convencional de qualquer bitola ou protegida até 150mm², com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704027','Instalar','CABOS MT PROTEGIDA >150mm2 3F','Vão',0.2400,0.2400,'Instalação/retirada de vão de cabos de MT trifásica protegida com bitola superior a 150mm², com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704028','Retirar','CABOS MT PROTEGIDA >150mm2 3F','Vão',0.1200,0.1200,'Instalação/retirada de vão de cabos de MT trifásica protegida com bitola superior a 150mm², com tensionamento, calibração, fixações, amarrações, espaçadores e conexões.'),
('704029','Instalar','CABOS MT ISOLADA MANUT','Vão',0.2793,0.2793,'Instalação/retirada de vão de cabo(s) de MT isolada de qualquer bitola, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704030','Retirar','CABOS MT ISOLADA MANUT','Vão',0.2205,0.2205,'Instalação/retirada de vão de cabo(s) de MT isolada de qualquer bitola, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704031','Instalar','CABOS MT SUBTERRÂNEA MANUT','Vão',0.3645,0.3645,'Instalação/retirada de vão de cabo(s) de MT de rede subterrânea de qualquer bitola, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704032','Retirar','CABOS MT SUBTERRÂNEA MANUT','Vão',0.1845,0.1845,'Instalação/retirada de vão de cabo(s) de MT de rede subterrânea de qualquer bitola, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704033','Emendar/Calibrar','CABO DE AÇO MENSAGEIRO MANUT','Vão',0.2230,0.2230,'Emenda e/ou calibração de cabo de aço de qualquer bitola, em um vão, independentemente do número de emendas.'),
('704034','Emendar/Calibrar','CABO MT CA <=1/0 / RDP <=50mm² MANUT','Fase',0.0701,0.0701,'Emenda e/ou calibração de cabo(s) de MT convencional CA até 1/0 AWG ou protegida até 50mm², independentemente do número de emendas.'),
('704035','Emendar/Calibrar','CABO MT CAA <=1/0 MANUT','Fase',0.2230,0.2230,'Emenda e/ou calibração de cabo(s) de MT convencional CAA até 1/0 AWG, independentemente do número de emendas.'),
('704036','Emendar/Calibrar','CABO MT CA >=4/0 / RDP >=150mm² MANUT','Fase',0.1147,0.1147,'Emenda e/ou calibração de cabo(s) de MT convencional CA acima de 1/0 AWG e protegida acima de 50mm², independentemente do número de emendas.'),
('704037','Emendar/Calibrar','CABO MT CAA >1/0 MANUT','Fase',0.2549,0.2549,'Emenda e/ou calibração de cabo(s) de MT convencional CAA acima de 1/0 AWG, independentemente do número de emendas.'),
('704038','Emendar/Calibrar','CABO MT ISOLADO MANUT','Fase',0.4572,0.4572,'Emenda e/ou calibração de cabo(s) de MT isolada de qualquer bitola, independentemente do número de emendas.'),
('704039','Instalar','CABOS BT CONVENCIONAL/ISOLADA MANUT','Vão',0.1183,0.1183,'Instalação/retirada de vão de cabo(s) de BT, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704040','Retirar','CABOS BT CONVENCIONAL/ISOLADA MANUT','Vão',0.0507,0.0507,'Instalação/retirada de vão de cabo(s) de BT, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704041','Instalar','CABO NEUTRO MANUT','Vão',0.1183,0.1183,'Instalação/retirada de vão de cabo neutro, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704042','Retirar','CABO NEUTRO MANUT','Vão',0.0507,0.0507,'Instalação/retirada de vão de cabo neutro, com tensionamento, calibração, fixações, amarrações e conexões.'),
('704043','Instalar','CABOS BT SUBTERRÂNEA MANUT','Vão',0.0630,0.0630,'Instalação/retirada de vão de cabo(s) de BT de rede subterrânea de qualquer bitola, com conexões.'),
('704044','Retirar','CABOS BT SUBTERRÂNEA MANUT','Vão',0.0345,0.0345,'Instalação/retirada de vão de cabo(s) de BT de rede subterrânea de qualquer bitola, com conexões.'),
('704045','Emendar/Calibrar','EMENDAR CABOS BT CONV/ISOLADA MANUT','Vão',0.0623,0.0623,'Emenda e/ou calibração de cabo(s) de BT monofásica ou trifásica de qualquer bitola, convencional ou isolada, em um vão, independentemente do número de condutores e emendas.'),
('704046','Substituir','CONEXÃO MT ISOLADA TME/TDC/TDR MANUT','Peça',0.1820,0.1820,'Realização de conexão TME, TDC ou TDR em rede isolada, com todos os serviços necessários.'),
('704047','Substituir','CONEXÃO MT RDS MANUT','Estrutura',0.1314,0.1314,'Substituição de conexão em rede subterrânea de MT, por estrutura, independentemente da quantidade de conexões.'),
('704048','Substituir','DESCONECTÁVEL DE RDI MANUT','Peça',0.1344,0.1344,'Substituição de desconectável de rede de MT isolada.'),
('704049','Substituir','DESCONECTÁVEL DE RDS MANUT','Peça',0.0691,0.0691,'Substituição de desconectável de rede de MT subterrânea.'),
('704050','Substituir','CONEXÃO BT RDS MANUT','Estrutura',0.1135,0.1135,'Substituição de conexão em rede subterrânea de BT, por estrutura, independentemente da quantidade de conexões.'),
('704051','Instalar','REGULADOR TENSÃO MT ENERGIZADA MANUT','Equipamento',0.4853,0.4853,'Instalação/retirada do equipamento com a rede de MT energizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704052','Retirar','REGULADOR TENSÃO MT ENERGIZADA MANUT','Equipamento',0.2080,0.2080,'Instalação/retirada do equipamento com a rede de MT energizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704053','Instalar','REGULADOR TENSÃO MT MANUT','Equipamento',0.4368,0.4368,'Instalação/retirada do equipamento com a rede de MT desenergizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704054','Retirar','REGULADOR TENSÃO MT MANUT','Equipamento',0.1872,0.1872,'Instalação/retirada do equipamento com a rede de MT desenergizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704055','Instalar','RELIGADOR/SECC/TRANSFORMADOR 1F MANUT','Equipamento',0.3200,0.3200,'Instalação/retirada do equipamento monofásico com a rede de MT desenergizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704056','Retirar','RELIGADOR/SECC/TRANSFORMADOR 1F MANUT','Equipamento',0.1500,0.1500,'Instalação/retirada do equipamento monofásico com a rede de MT desenergizada, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704057','Instalar','RELIG/SECC/TR MT ENERGIZADA 1F MANUT','Equipamento',0.3680,0.3680,'Instalação/retirada do equipamento monofásico com a rede de MT energizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704058','Retirar','RELIG/SECC/TR MT ENERGIZADA 1F MANUT','Equipamento',0.1725,0.1725,'Instalação/retirada do equipamento monofásico com a rede de MT energizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704059','Instalar','RELIG/SEC/CHAVE SF6/CJ MED/TR 3F MANUT','Equipamento',0.5500,0.5500,'Instalação/retirada do equipamento trifásico com a rede de MT desenergizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704060','Retirar','RELIG/SEC/CHAVE SF6/CJ MED/TR 3F MANUT','Equipamento',0.2500,0.2500,'Instalação/retirada do equipamento trifásico com a rede de MT desenergizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704061','Instalar','RELIG/SEC/SF6/CJ MED/TR MT ENER 3F MAN','Equipamento',0.6325,0.6325,'Instalação/retirada do equipamento trifásico com a rede de MT energizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704062','Retirar','RELIG/SEC/SF6/CJ MED/TR MT ENER 3F MAN','Equipamento',0.2875,0.2875,'Instalação/retirada do equipamento trifásico com a rede de MT energizada (religador, seccionalizador, chave SF6, conjunto de medição ou transformador), incluindo barramentos, jumpers, conexões e placa de numeração.'),
('704063','Instalar','CHAVE FACA MANUT','Equipamento',0.1283,0.1283,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704064','Retirar','CHAVE FACA MANUT','Equipamento',0.0259,0.0259,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704065','Instalar','CHAVE FACA ADAPTADA MANUT','Equipamento',0.0400,0.0400,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704066','Retirar','CHAVE FACA ADAPTADA MANUT','Equipamento',0.0198,0.0198,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704067','Instalar','CHAVE FUSÍVEL MANUT','Equipamento',0.0400,0.0400,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704068','Retirar','CHAVE FUSÍVEL MANUT','Equipamento',0.0198,0.0198,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704069','Instalar','CHAVE REPETIDORA MANUT','Equipamento',0.1283,0.1283,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões, acessórios e placa de numeração, se houver.'),
('704070','Retirar','CHAVE REPETIDORA MANUT','Equipamento',0.0249,0.0249,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões, acessórios e placa de numeração, se houver.'),
('704071','Retirar','CHAVE FACA BASCULANTE 3F MANUT','Equipamento',0.1887,0.1887,'Retirada do equipamento, incluindo barramentos, jumpers, conexões e placa de numeração, se houver.'),
('704072','Instalar','CAPACITOR MANUT','Equipamento',0.3055,0.3055,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e eventuais acessórios de automação, bem como placas de numeração, se houver.'),
('704073','Retirar','CAPACITOR MANUT','Equipamento',0.2272,0.2272,'Instalação/retirada do equipamento, incluindo barramentos, jumpers, conexões e eventuais acessórios de automação, bem como placas de numeração, se houver.'),
('704074','Instalar','PARA-RAIOS INDICADOR DEFEITOS MT MANUT','Equipamento',0.0400,0.0400,'Instalação/retirada do equipamento, incluindo barramentos, jumpers e conexões.'),
('704075','Retirar','PARA-RAIOS INDICADOR DEFEITOS MT MANUT','Equipamento',0.0100,0.0100,'Instalação/retirada do equipamento, incluindo barramentos, jumpers e conexões.'),
('704076','Instalar','PARA-RAIOS INDICADOR DEFEITOS BT MANUT','Equipamento',0.0200,0.0200,'Instalação/retirada do equipamento, incluindo barramentos, jumpers e conexões.'),
('704077','Retirar','PARA-RAIOS INDICADOR DEFEITOS BT MANUT','Equipamento',0.0050,0.0050,'Instalação/retirada do equipamento, incluindo barramentos, jumpers e conexões.'),
('704078','Instalar','ATERRAMENTO ATÉ 3 HASTES MANUT','Aterramento Completo',0.2890,0.2890,'Instalação completa de aterramento, com escavação, instalação de hastes, lançamento de condutores, conexões e recomposição de piso.'),
('704079','Instalar','HASTE ADICIONAL PARA ATERRAMENTO MANUT','Haste',0.0700,0.0700,'Escavação, instalação de haste adicional, lançamento de condutor, conexões e recomposição de piso. Inclui medir a resistividade do solo e anotá-la no projeto ou na nota de serviço.'),
('704080','Instalar','ATERRAR/SECCIONAR CERCA OU TELA MANUT','Ponto',0.2018,0.2018,'Seccionamento da cerca ou tela e aterramento completo, com escavação, hastes, condutores, conexões e recomposição de piso.'),
('704081','Instalar','ESTAI MANUT','Estai',0.0500,0.0500,'Instalação/retirada de estai de cruzeta a cruzeta, cruzeta a poste ou poste a poste, incluindo fixações e conexões, independentemente do número de pontos ou estruturas.'),
('704082','Instalar','ESTAI ÂNCORA MANUT','Estai',0.0500,0.0500,'Instalação/retirada de estai de âncora, incluindo fixações e conexões, independentemente do número de pontos ou estruturas.'),
('704083','Tensionar','ESTAI TENSIONAR MANUT','Estai',0.0221,0.0221,'Tensionamento do cabo do estai incluindo fixações e conexões, independentemente do tipo de estai e do número de pontos ou estruturas.'),
('704084','Instalar','COBERTURA PROTETORA BUCHA MT/BT MANUT','Peça',0.0338,0.0338,'Instalação de protetor de bucha de MT ou BT em buchas de equipamentos.'),
('704085','Substituir','BARRAMENTO TRANSFORMADOR 1F MANUT','Equipamento',0.0950,0.0950,'Substituição do(s) barramento(s) de transformador monofásico, independentemente da quantidade de barramentos.'),
('704086','Substituir','BARRAMENTO TRANSFORMADOR 3F MANUT','Equipamento',0.1128,0.1128,'Substituição do(s) barramento(s) de transformador trifásico, independentemente da quantidade de barramentos.'),
('704087','Instalar','SEPARADOR VERTICAL MT RDP MANUT','Peça',0.0830,0.0830,'Instalação ou substituição de separador vertical de MT em RDP, por peça instalada.'),
('704088','Instalar','ESPAÇADOR MT MANUT','Peça',0.0775,0.0775,'Instalação ou substituição de espaçador de MT, em qualquer tipo de rede.'),
('704089','Instalar','ESPAÇADOR BT MANUT','Vão',0.1195,0.1195,'Instalação de até 5 espaçadores em rede de BT, incluindo amarrações e demais acessórios necessários.'),
('704090','Instalar','PONTO P/ ATERRAMENTO TEMPORÁRIO MANUT','Peça',0.0332,0.0332,'Instalação de ponto de aterramento temporário em cabo ou na chave fusível/chave faca.'),
('704091','Podar','PODAR ÁRVORE MANUT','Árvore',0.0600,0.0600,'Poda de árvore em rede primária e/ou secundária sem proteção, com recolhimento e destinação final de resíduos.'),
('704092','Instalar/Retirar','INTERLIGAÇÃO CIRCUITO BT MANUT','Estrutura',0.0332,0.0332,'Instalação ou retirada de interligação entre circuitos de BT, independentemente do número de fases e de conexões.'),
('704093','Substituir','ELO FUSÍVEL/CARTUCHO/LÂMINA MANUT','Estrutura',0.0779,0.0779,'Substituição de elo fusível, cartucho ou cartucho lâmina, sem by-pass, independentemente da quantidade.'),
('704094','Substituir','ELO FUSÍVEL/CART/LAM C/ BY-PASS MANUT','Estrutura',0.1448,0.1448,'Substituição de elo fusível, cartucho ou cartucho lâmina, com by-pass, independentemente da quantidade.'),
('704095','Instalar','EQUIPAMENTO MEDIÇÃO MT MANUT','Equipamento',0.1447,0.1447,'Instalação/retirada do equipamento de medição temporária, incluindo conexões.'),
('704096','Retirar','EQUIPAMENTO MEDIÇÃO MT MANUT','Equipamento',0.0786,0.0786,'Instalação/retirada do equipamento de medição temporária, incluindo conexões.'),
('704097','Instalar','EQUIPAMENTO MEDIÇÃO BT MANUT','Equipamento',0.1384,0.1384,'Instalação/retirada do equipamento de medição temporária, incluindo conexões.'),
('704098','Retirar','EQUIPAMENTO MEDIÇÃO BT MANUT','Equipamento',0.0767,0.0767,'Instalação/retirada do equipamento de medição temporária, incluindo conexões.'),
('704099','Coletar','LEITURA EM RELIGADOR MANUT','Equipamento',0.1010,0.1010,'Leitura de dados de religadores com registro em planilha específica.'),
('704100','Instalar','NUMERAÇÃO DE EQUIPAMENTO MANUT','Equipamento',0.0166,0.0166,'Pintura de numeração em qualquer tipo de equipamento.'),
('704101','Instalar','PARAMETRIZAÇÃO TRIP SAVER MANUT','Equipamento',0.0380,0.0380,'Parametrização de religador monofásico do tipo TRIP SAVER.'),
('704102','Instalar','PLACA IDENTIFICAÇÃO EQUIPAMENTO MANUT','Equipamento',0.0166,0.0166,'Instalação de placa de identificação em qualquer tipo de equipamento.'),
('704103','Instalar','AGARRA PAPAGAIO MANUT','Estrutura',0.0500,0.0500,'Instalação de agarras para papagaios (pipa) na estrutura trabalhada, independentemente do número de agarras.'),
('704104','Instalar/Substituir','AMARRAÇÃO ESTRUTURA MANUT','Estrutura',0.1028,0.1028,'Amarração de condutores em estruturas de BT ou MT, monofásicas ou trifásicas, independentemente da quantidade.'),
('704105','Retirar','OBJETO ESTRANHO NA REDE MANUT','Estrutura',0.0735,0.0735,'Retirada de objeto(s) estranho(s) na rede, por estrutura e vãos adjacentes, independentemente da quantidade de objetos.'),
('704106','Limpar','LIMPEZA DE FAIXA MANUT','Vão',0.2250,0.2250,'Limpeza e/ou conservação de faixa de servidão sob RDA, por vão, independentemente do tipo de rede e do número de fases.'),
('704107','Inspecionar','INSPEÇÃO DETALHADA RDR MANUT','km',0.1600,0.1600,'Inspeção detalhada em RDR para verificação de defeitos/avarias na rede, com cadastro em sistema corporativo.'),
('704108','Inspecionar','INSPEÇÃO DETALHADA RDU MANUT','km',0.0800,0.0800,'Inspeção detalhada em RDU para verificação de defeitos/avarias na rede, com cadastro em sistema corporativo.'),
('704109','Inspecionar','INSPEÇÃO DETALHADA RDR COM DRONE MANUT','km',0.0720,0.0720,'Inspeção em RDR para verificação de defeitos/avarias na rede, com utilização de DRONE (RPA).'),
('704110','Inspecionar','INSPEÇÃO PARA PODA DE ÁRVORE MANUT','Árvore',0.0200,0.0200,'Inspeção detalhada em RDA para verificação de árvores a serem podadas, com cadastro em sistema corporativo.'),
('704111','Inspecionar','INSPEÇÃO LEVANTAMENTO DE FAIXA MANUT','km',0.0600,0.0600,'Inspeção detalhada em RDA para verificação de faixa a ser limpa, com cadastro em sistema corporativo.'),
('704112','Inspecionar','INSPEÇÃO RÁPIDA RDR MANUT','km',0.0600,0.0600,'Inspeção rápida em RDR para verificação de anomalias/defeitos, de poste a poste, com cadastro em sistema corporativo.'),
('704113','Inspecionar','INSPEÇÃO RÁPIDA RDU MANUT','km',0.0600,0.0600,'Inspeção rápida em RDU para verificação de anomalias/defeitos, de poste a poste, com cadastro em sistema corporativo.'),
('704114','Inspecionar','INSPEÇÃO RECEPÇÃO DE FAIXA LIMPA MANUT','km',0.0400,0.0400,'Inspeção para recepção de faixa limpa e conservada, com cadastro em sistema corporativo.'),
('704115','Inspecionar','INSPEÇÃO TERMOGRÁFICA RDU MANUT','km',0.1200,0.1200,'Inspeção termográfica em RDU, com cadastro em sistema corporativo.'),
('704116','Inspecionar','INSP/AJUSTE/TESTE SUBIDA EQUIP MANUT','Equipamento',0.1600,0.1600,'Inspeção, ajustes e testes operativos com subida em equipamentos de rede (capacitor, chave tripolar, religador ou seccionalizador).'),
('704117','Inspecionar','INSPEÇÃO CADASTRO DE ÁRVORE MANUT','km',0.0510,0.0510,'Inspeção detalhada em RDA para verificação de poda de árvore, com cadastro georreferenciado.'),
('704118','Instalar/Substituir','ISOLADOR BASTÃO EM ESTAI MANUT','Peça',0.0610,0.0610,'Seccionamento do cabo de aço do estai e instalação ou substituição de isolador bastão polimérico.'),
('704119','Substituir','ISOLADOR DISCO/BASTÃO EM REDE MANUT','Cadeia',0.0610,0.0610,'Substituição de conjunto de isolador de disco ou bastão polimérico em rede de MT convencional ou protegida, por peça/conjunto.'),
('704120','Substituir','ISOLADOR PINO REDE CONV OU RDP MANUT','Isolador',0.0338,0.0338,'Substituição de isolador de pino em rede de MT, incluindo o pino do isolador, quando necessário.'),
('704121','Abrir/Fechar','ABRIR/FECHAR JUMPER SEC CIRCUITO MANUT','Estrutura',0.0800,0.0800,'Abertura ou fechamento de jumper em seccionamento de circuito de MT ou BT, especialmente em condição de manobra.'),
('704122','Substituir','JUMPER MT CHAVE FUSÍVEL MANUT','Estrutura',0.0800,0.0800,'Substituição de jumper de chave fusível, por estrutura, independentemente do número de jumpers.'),
('704123','Substituir','JUMPER MT ESTRUTURA DOIS NÍVEIS MANUT','Estrutura',0.0800,0.0800,'Substituição de jumper em estrutura com dois níveis, por estrutura, independentemente do número de jumpers.'),
('704124','Substituir','JUMPER MT/BT FLY-TAP MANUT','Fase',0.0800,0.0800,'Substituição de jumper em fly-tap, por fase, independentemente do número de jumpers.'),
('704125','Substituir','JUMPER MT/BT PARA-RAIOS MANUT','Estrutura',0.0800,0.0800,'Substituição de jumper de para-raios de MT ou BT, por estrutura, independentemente do número de fases e de jumpers.'),
('704126','Substituir','JUMPER MT RELIG/SECC/REGULADOR MANUT','Jumper',0.0800,0.0800,'Substituição de jumper de religador, seccionalizador ou regulador de tensão, por jumper substituído.'),
('704127','Substituir','JUMPER MT TRANSFORMADOR MANUT','Estrutura',0.0800,0.0800,'Substituição de jumper de transformador monofásico ou trifásico, por estrutura, independentemente do número de jumpers.'),
('704128','Abrir/Fechar','OPERAR DISPOSITIVO P/ TRANSF CARGA MAN','Ponto',0.0669,0.0669,'Operação de dispositivo de proteção ou manobra para transferência de carga, incluindo a sinalização, quando pertinente.'),
('704129','Instalar','SINALIZAR DISPOSITIVO MANOBRA NA MANUT','Equipamento',0.0530,0.0530,'Sinalização de dispositivo de proteção ou manobra (NA), exceto dispositivo manobrado.'),
('704130','Recolher','RECOLHER TERRA COM ÓLEO MANUT','Ponto',0.2000,0.2000,'Recolhimento de terra impregnada com óleo ou resíduo lubrificante, incluindo, se for o caso, o recolhimento da carcaça de equipamentos caídos ao solo.'),
('704131','Manejar','MANEJAR VESPEIRO MANUT','Vespeiro',0.0841,0.0841,'Captura e/ou eliminação de vespeiros em poste ou estrutura da rede de distribuição.'),
('704132','Instalar','RECOMPOR PASSEIO MANUT','Ponto',0.0664,0.0664,'Recomposição de passeio, independentemente do acabamento do piso, sem estar atrelado à substituição, retirada ou instalação de poste ou contra poste.'),
('704133','Instalar','RAMAL LIGAÇÃO BT AÉREO MANUT','Ramal',0.0980,0.0980,'Instalação/retirada de ramal de ligação aéreo em BT, independentemente do número de fases.'),
('704134','Retirar','RAMAL LIGAÇÃO BT AÉREO MANUT','Ramal',0.0667,0.0667,'Instalação/retirada de ramal de ligação aéreo em BT, independentemente do número de fases.'),
('704135','Instalar','RAMAL LIGAÇÃO BT AÉREO MUDA FASE MANUT','Poste',0.0950,0.0950,'Alteração de fase(s) do(s) ramal(is) de ligação em BT existente(s), independentemente do número de ramais.'),
('704136','Instalar','RAMAL LIGAÇÃO BT SUBTERRÂNEO MANUT','Ramal',0.0542,0.0542,'Instalação/retirada de ramal de ligação subterrâneo em BT, independentemente do número de fases.'),
('704137','Retirar','RAMAL LIGAÇÃO BT SUBTERRÂNEO MANUT','Ramal',0.0164,0.0164,'Instalação/retirada de ramal de ligação subterrâneo em BT, independentemente do número de fases.'),
('704138','Instalar','VALETA ASFALTO COM DUTOS/CABOS MANUT','Metro linear',0.2400,0.2400,'Abertura de valeta em asfalto, com lançamento de dutos e cabos, incluindo a recomposição do piso, com fornecimento do concreto asfáltico.'),
('704139','Instalar','VALETA GRAMADO COM DUTOS/CABOS MANUT','Metro linear',0.0600,0.0600,'Abertura de valeta em gramado, com lançamento de dutos e cabos, incluindo a recomposição do piso, com fornecimento da grama.'),
('704140','Instalar','VALETA PASSEIO COM DUTOS/CABOS MANUT','Metro linear',0.0800,0.0800,'Abertura de valeta em passeio, com lançamento de dutos e cabos, incluindo a recomposição do piso, com fornecimento de material comum (concreto).'),
('704141','Instalar','VALETA TERRA COM DUTOS/CABOS MANUT','Metro linear',0.0500,0.0500,'Abertura de valeta em terra, com lançamento de dutos e cabos, incluindo a recomposição do piso.'),
('704142','Instalar','CONCRETAR BANCO DE DUTOS MANUT','Metro linear',0.0543,0.0543,'Preparação do concreto e concretagem do banco de dutos, bem como a remuneração dos materiais necessários.'),
('704143','Instalar/Refazer','CAIXA INSPEÇÃO ZA MANUT','Caixa',0.0764,0.0764,'Abertura da cava, instalação ou reconstrução da caixa de inspeção, com anel e tampa, e acabamento geral.'),
('704144','Instalar/Refazer','CAIXA INSPEÇÃO ZB MANUT','Caixa',0.2270,0.2270,'Abertura da cava, instalação ou reconstrução da caixa de inspeção, com anel e tampa, e acabamento geral.'),
('704145','Instalar/Refazer','CAIXA INSPEÇÃO ZC MANUT','Caixa',0.3412,0.3412,'Abertura da cava, instalação ou reconstrução da caixa de inspeção, com anel e tampa, e acabamento geral.'),
('704146','Instalar/Refazer','CAIXA INSPEÇÃO ZD MANUT','Caixa',0.6694,0.6694,'Abertura da cava, instalação ou reconstrução da caixa de inspeção, com anel e tampa, e acabamento geral.'),
('704147','Instalar','DESCIDA DE POSTE ELETRODUTOS/CABOS','Prumada',0.0400,0.0400,'Instalação e fixação do(s) eletroduto(s) junto ao poste e lançamento dos cabos necessários.'),
('704148','Retirar','DESCIDA DE POSTE ELETRODUTOS/CABOS','Prumada',0.0120,0.0120,'Instalação e fixação do(s) eletroduto(s) junto ao poste e lançamento dos cabos necessários.')
on conflict (codigo) do nothing;
