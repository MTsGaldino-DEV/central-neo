-- ════════════════════════════════════════════════════════════════════════════
-- Central NEO — 009: carga de localidade → supervisor (postos de supervisão)
--
-- Lista passada pelo Matheus em 2026-10-20. Ficaram de fora: "12" (repetida
-- de 0012, CAPITAO ANDRADE) e 4351 BARRA MANSA (sem posto na lista).
-- Reaplicar atualiza o supervisor, o posto e o município.
-- ════════════════════════════════════════════════════════════════════════════

alter table public.neo_localidade_supervisor add column if not exists municipio text;
alter table public.neo_localidade_supervisor add column if not exists posto text;

insert into public.neo_localidade_supervisor (localidade, municipio, posto, supervisor) values
  ('4164', 'AGUA BOA', 'Posto 2', 'Elton'),
  ('4162', 'AIMORES', 'Posto 3', 'Vinicius'),
  ('4106', 'ALPERCATA', 'Posto 1', 'Pedro'),
  ('4238', 'ALVARENGA', 'Posto 1', 'Pedro'),
  ('4143', 'CANTAGALO', 'Posto 2', 'Elton'),
  ('0012', 'CAPITAO ANDRADE', 'Posto 1', 'Pedro'),
  ('4190', 'CENTRAL DE MINAS', 'Posto 4', 'Victor'),
  ('4165', 'COLUNA', 'Posto 2', 'Elton'),
  ('4102', 'CONSELHEIRO PENA', 'Posto 3', 'Vinicius'),
  ('4108', 'COROACI', 'Posto 4', 'Victor'),
  ('4154', 'CUPARAQUE', 'Posto 3', 'Vinicius'),
  ('4105', 'DIVINO LARANJEIRAS', 'Posto 4', 'Victor'),
  ('4168', 'ENGENHEIRO CALDAS', 'Posto 1', 'Pedro'),
  ('4170', 'FERNANDES TOURINHO', 'Posto 1', 'Pedro'),
  ('4109', 'FREI INOCENCIO', 'Posto 1', 'Pedro'),
  ('4538', 'FREI LAGO NEGRO', 'Posto 2', 'Elton'),
  ('4110', 'GALILEIA', 'Posto 3', 'Vinicius'),
  ('4194', 'GOIABEIRA', 'Posto 3', 'Vinicius'),
  ('4186', 'GONZAGA', 'Posto 2', 'Elton'),
  ('4101', 'GOVERNADOR VALADARES', 'Posto 1', 'Pedro'),
  ('4103', 'ITABIRINHA DE MANTENA', 'Posto 4', 'Victor'),
  ('4174', 'ITANHOMI', 'Posto 1', 'Pedro'),
  ('4161', 'ITUETA', 'Posto 3', 'Vinicius'),
  ('4410', 'JAMPRUCA', 'Posto 1', 'Pedro'),
  ('4558', 'JATAI', 'Posto 1', 'Pedro'),
  ('4199', 'JOSE RAYDAN', 'Posto 2', 'Elton'),
  ('4189', 'MANTENA', 'Posto 4', 'Victor'),
  ('4175', 'MARILAC', 'Posto 4', 'Victor'),
  ('4115', 'MATHIAS LOBATO', 'Posto 1', 'Pedro'),
  ('4104', 'MENDES PIMENTEL', 'Posto 4', 'Victor'),
  ('4177', 'NACIP RAYDAN', 'Posto 4', 'Victor'),
  ('4506', 'NOVA BELEM', 'Posto 4', 'Victor'),
  ('4183', 'PAULISTAS', 'Posto 2', 'Elton'),
  ('4128', 'PECANHA', 'Posto 2', 'Elton'),
  ('4157', 'RESPLENDOR', 'Posto 3', 'Vinicius'),
  ('4185', 'SANTA EFIGENIA DE MINAS', 'Posto 2', 'Elton'),
  ('4132', 'SANTA MARIA DO SUACUI', 'Posto 2', 'Elton'),
  ('4158', 'SANTA RITA DO ITUETO', 'Posto 3', 'Vinicius'),
  ('4191', 'SAO FELIX DE MINAS', 'Posto 4', 'Victor'),
  ('4187', 'SAO GERALDO DA PIEDADE', 'Posto 2', 'Elton'),
  ('4535', 'SAO GERALDO DO BAIXIO', 'Posto 3', 'Vinicius'),
  ('4530', 'SAO GERALDO TUMIRITINGA', 'Posto 1', 'Pedro'),
  ('4518', 'SAO JOAO DO MANTENINHA', 'Posto 4', 'Victor'),
  ('4131', 'SAO JOAO EVANGELISTA', 'Posto 2', 'Elton'),
  ('4176', 'SAO JOSE DA SAFIRA', 'Posto 4', 'Victor'),
  ('4163', 'SAO JOSE DO JACURI', 'Posto 2', 'Elton'),
  ('4134', 'SAO PEDRO DO SUACUI', 'Posto 2', 'Elton'),
  ('4172', 'SAO SEBASTIAO DO MARANHAO', 'Posto 2', 'Elton'),
  ('4184', 'SARDOA', 'Posto 2', 'Elton'),
  ('4169', 'SOBRALIA', 'Posto 1', 'Pedro'),
  ('4235', 'TARUMIRIM', 'Posto 1', 'Pedro'),
  ('4532', 'TIPITI', 'Posto 4', 'Victor'),
  ('4114', 'TUMIRITINGA', 'Posto 1', 'Pedro'),
  ('4173', 'VIRGOLANDIA', 'Posto 4', 'Victor')
on conflict (localidade) do update set
  municipio  = excluded.municipio,
  posto      = excluded.posto,
  supervisor = excluded.supervisor;
