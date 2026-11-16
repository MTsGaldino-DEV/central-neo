/**
 * lib/localidades.ts — código da localidade (4 primeiros dígitos da referência) → nome do município.
 * Puro, sem rede. Código que não está na lista continua aparecendo como número.
 */
export const MUNICIPIOS: { local: string; nome: string }[] = [
  { local: '4164', nome: 'AGUA BOA' }, { local: '4162', nome: 'AIMORES' },
  { local: '4106', nome: 'ALPERCATA' }, { local: '4238', nome: 'ALVARENGA' },
  { local: '4351', nome: 'BARRA MANSA' }, { local: '4143', nome: 'CANTAGALO' },
  { local: '0012', nome: 'CAPITÃO ANDRADE' }, { local: '4190', nome: 'CENTRAL DE MINAS' },
  { local: '4165', nome: 'COLUNA' }, { local: '4102', nome: 'CONSELHEIRO PENA' },
  { local: '4108', nome: 'COROACI' }, { local: '4154', nome: 'CUPARAQUE' },
  { local: '4105', nome: 'DIVINO LARANJEIRAS' }, { local: '4168', nome: 'ENGENHEIRO CALDAS' },
  { local: '4170', nome: 'FERNANDES TOURINHO' }, { local: '4109', nome: 'FREI INOCENCIO' },
  { local: '4538', nome: 'FREI LAGO NEGRO' }, { local: '4110', nome: 'GALILEIA' },
  { local: '4194', nome: 'GOIABEIRA' }, { local: '4186', nome: 'GONZAGA' },
  { local: '4101', nome: 'GOVERNADOR VALADARES' }, { local: '4103', nome: 'ITABIRINHA DE MANTENA' },
  { local: '4174', nome: 'ITANHOMI' }, { local: '4161', nome: 'ITUETA' },
  { local: '4410', nome: 'JAMPRUCA' }, { local: '4558', nome: 'JATAI' },
  { local: '4199', nome: 'JOSE RAYDAN' }, { local: '4189', nome: 'MANTENA' },
  { local: '4175', nome: 'MARILAC' }, { local: '4115', nome: 'MATHIAS LOBATO' },
  { local: '4104', nome: 'MENDES PIMENTEL' }, { local: '4177', nome: 'NACIP RAYDAN' },
  { local: '4506', nome: 'NOVA BELEM' }, { local: '4183', nome: 'PAULISTAS' },
  { local: '4128', nome: 'PECANHA' }, { local: '4157', nome: 'RESPLENDOR' },
  { local: '4185', nome: 'SANTA EFIGENIA DE MINAS' }, { local: '4132', nome: 'SANTA MARIA DO SUACUI' },
  { local: '4158', nome: 'SANTA RITA DO ITUETO' }, { local: '4191', nome: 'SAO FELIX DE MINAS' },
  { local: '4187', nome: 'SAO GERALDO DA PIEDADE' }, { local: '4535', nome: 'SAO GERALDO DO BAIXIO' },
  { local: '4530', nome: 'SAO GERALDO TUMIRITINGA' }, { local: '4518', nome: 'SAO JOAO DO MANTENINHA' },
  { local: '4131', nome: 'SAO JOAO EVANGELISTA' }, { local: '4176', nome: 'SAO JOSE DA SAFIRA' },
  { local: '4163', nome: 'SAO JOSE DO JACURI' }, { local: '4134', nome: 'SAO PEDRO DO SUACUI' },
  { local: '4172', nome: 'SAO SEBASTIAO DO MARANHAO' }, { local: '4184', nome: 'SARDOA' },
  { local: '4169', nome: 'SOBRALIA' }, { local: '4235', nome: 'TARUMIRIM' },
  { local: '4532', nome: 'TIPITI' }, { local: '4114', nome: 'TUMIRITINGA' },
  { local: '4173', nome: 'VIRGOLANDIA' },
];

/** O código vem como "12" ou "0012" conforme a origem: compara sempre com 4 dígitos. */
const normalizar = (cod: string) => cod.trim().padStart(4, '0');

const NOME_POR_CODIGO = new Map(MUNICIPIOS.map((m) => [normalizar(m.local), m.nome]));

/** Nome do município da localidade; null quando o código não está cadastrado. */
export function nomeLocalidade(codigo: string | null | undefined): string | null {
  if (!codigo?.trim()) return null;
  return NOME_POR_CODIGO.get(normalizar(codigo)) ?? null;
}

/** Texto para a tela: o nome, ou o próprio código se não houver nome. */
export function rotuloLocalidade(codigo: string | null | undefined): string {
  return nomeLocalidade(codigo) ?? codigo ?? '—';
}
