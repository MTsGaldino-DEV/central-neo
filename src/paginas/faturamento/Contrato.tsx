import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { contratosFat, acertarContratoFat, configFat, historicoFat, usFat, erroFat, type ContratoFat, type HistoricoFat } from '@/lib/faturamento';
import { valorMoto } from '@/lib/faturamentoMoto';
import { CarregandoNeo } from '@/components/faturamento/CarregandoNeo';
import { JanelaModal } from '@/components/faturamento/JanelaModal';
import { RodapeFat } from '@/components/faturamento/AjudaFat';

const fatorTexto = (n: number | null) => n == null ? '—' : n.toLocaleString('pt-BR');

export default function Contrato() {
  const { acesso } = useSessao();
  const admin = acesso?.papel === 'ADMIN';
  const [lista,setLista] = useState<ContratoFat[]>([]), [busca,setBusca] = useState(''), [tabela,setTabela] = useState('');
  const [motoUrbano,setMotoUrbano] = useState(0.7);
  const [erro,setErro] = useState(''),[carregando,setCarregando] = useState(true),[salvando,setSalvando] = useState(false);
  const [item,setItem] = useState<ContratoFat|null>(null),[historico,setHistorico] = useState<HistoricoFat[]>([]);
  async function carregar() { setCarregando(true); try { setLista(await contratosFat()); } catch(e) {setErro(erroFat(e));} finally {setCarregando(false);} }
  useEffect(()=>{void carregar();configFat().then(c=>setMotoUrbano(c.moto_urbano)).catch(e=>setErro(erroFat(e)));},[]);
  async function abrir(c:ContratoFat) { setItem(c);setHistorico([]);setErro('');if(admin)try {setHistorico(await historicoFat(c));} catch(e){setErro(erroFat(e));} }
  async function salvar(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!item)return;const f=new FormData(e.currentTarget);setSalvando(true);setErro('');
    try {await acertarContratoFat(item,Number(f.get('csc')),Number(f.get('cod')),f.get('ativo')==='on',String(f.get('motivo')));setItem(null);await carregar();}
    catch(e){setErro(erroFat(e));}finally{setSalvando(false);}
  }
  const visiveis = lista.filter(c=>(!tabela||c.tabela===tabela)&&`${c.codigo} ${c.descricao}`.toLowerCase().includes(busca.toLowerCase()));
  return <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-extrabold">Tabelas do contrato</h2><p className="text-sm text-aco">Tabela 11 · códigos de fechamento / Tabela 12 · atendimentos RC. Valores em US.</p></div>
      <Link to="/faturamento/documentacao#contrato" className="inline-flex items-center gap-1.5 rounded-xl border border-linha bg-white px-3 py-2 text-sm font-bold text-sinal hover:border-sinal"><BookOpen className="size-4" aria-hidden="true"/>Documentação</Link>
    </div>
    <p className="p-4 rounded-xl bg-sinal-fundo text-sinal text-sm">Os fatores publicados no contrato independem do valor pago na fatura. CSC/CSI e COD são comparados na Conferência. O Valor Moto já vem calculado: fator {fatorTexto(motoUrbano)} na maioria dos códigos, 1 nos que pagam sem desconto e 0 nos que não pagam Moto.</p>
    {erro && !item && <p role="alert" className="text-erro">{erro}</p>}
    <div className="flex gap-3"><input aria-label="Buscar código ou descrição" placeholder="Código ou descrição" value={busca} onChange={e=>setBusca(e.target.value)} className="border border-linha rounded-lg p-2 flex-1 min-w-0"/><select aria-label="Tabela" value={tabela} onChange={e=>setTabela(e.target.value)} className="border border-linha rounded-lg p-2"><option value="">Todas as tabelas</option><option>11</option><option>12</option></select></div>
    {carregando && !lista.length ? <CarregandoNeo variante="lista"/> : <div className="bg-white border border-linha rounded-2xl overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-nevoa"><tr>{['Tabela','Código','Descrição','CSC/CSI','COD','Fator Moto','Valor Moto','Validação'].map(h=><th className="p-3 whitespace-nowrap" key={h}>{h}</th>)}</tr></thead><tbody>
      {visiveis.map(c=>{const m=valorMoto(c,motoUrbano);return <tr key={c.tabela+c.codigo} data-codigo={c.codigo} className="border-t border-linha hover:bg-nevoa"><td className="p-3">{c.tabela}</td><td className="p-3 font-codigo"><button className="text-sinal underline" onClick={()=>void abrir(c)}>{c.codigo}</button></td><td className="p-3 max-w-md"><p className="line-clamp-2">{c.descricao}</p>{c.nota&&<span className="text-cobre">Com NOTA no contrato</span>}</td><td className="p-3 font-codigo">{usFat(c.fator_csc)}</td><td className="p-3 font-codigo">{usFat(c.fator_cod)}</td>
        <td className="p-3 font-codigo">{fatorTexto(m.fator)}</td>
        <td className="p-3">{m.naoPaga?<span className="text-xs text-aco">não paga Moto</span>:<div className="font-codigo text-xs leading-5"><div>CSC {usFat(m.csc)}</div><div>COD {usFat(m.cod)}</div>{m.semDesconto&&<span className="mt-0.5 inline-block rounded-full bg-sinal-fundo px-2 text-[11px] font-bold text-sinal font-sans">sem desconto</span>}</div>}</td>
        <td className="p-3">{!c.ativo?'Desativado':c.validado?'Validado':'A carregar manualmente'}</td></tr>;})}
    </tbody></table>{!carregando&&!lista.length&&<p className="p-6">Nenhum código carregado.</p>}</div>}
    {item&&<JanelaModal aberta titulo={`Tabela ${item.tabela} · ${item.codigo}`} onFechar={()=>!salvando&&setItem(null)}
      rodape={admin&&<button form="acerto-contrato" disabled={salvando} className="bg-sinal text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60">{salvando?'Salvando…':'Salvar acerto'}</button>}>
      <div className="space-y-4 text-sm">
        <p className="whitespace-pre-line">{item.descricao}</p><p>Como lançar: {item.como_lancar??'Consultar descrição'}</p>
        <p>Fator Moto: <b className="font-codigo">{fatorTexto(valorMoto(item,motoUrbano).fator)}</b></p>{item.nota&&<p className="whitespace-pre-line text-cobre">{item.nota}</p>}
        <p className="text-xs text-aco">{item.origem}</p><p>Publicados: CSC {usFat(item.fator_original)} / COD {usFat(item.fator_cod_original)}</p>
        {admin&&<form id="acerto-contrato" onSubmit={salvar} className="space-y-3"><label className="block font-bold">Fator CSC/CSI<input name="csc" type="number" min="0" step="0.000001" required defaultValue={item.fator_csc??''} className="mt-1 border border-linha rounded-lg p-2 w-full font-normal"/></label><label className="block font-bold">Fator COD<input name="cod" type="number" min="0" step="0.000001" required defaultValue={item.fator_cod??''} className="mt-1 border border-linha rounded-lg p-2 w-full font-normal"/></label><label className="block"><input type="checkbox" name="ativo" defaultChecked={item.ativo}/> Ativo</label><label className="block font-bold">Motivo do acerto<textarea name="motivo" minLength={3} required className="mt-1 border border-linha rounded-lg p-2 w-full font-normal"/></label></form>}
        {admin&&<div><h4 className="font-bold">Histórico</h4>{historico.map(h=><p key={h.id} className="border-t border-linha py-3">{new Date(h.data).toLocaleString('pt-BR')} · {h.motivo}<br/>CSC: {usFat(h.anterior.fator_csc)} → {usFat(h.novo.fator_csc)} · COD: {usFat(h.anterior.fator_cod)} → {usFat(h.novo.fator_cod)}<br/>Usuário: {h.usuario}</p>)}</div>}{erro&&<p role="alert" className="text-erro">{erro}</p>}
      </div>
    </JanelaModal>}
    <RodapeFat/>
  </div>;
}
