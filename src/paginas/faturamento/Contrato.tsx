import { useEffect, useState, type FormEvent } from 'react';
import { useSessao } from '@/contexto/Sessao';
import { contratosFat, acertarContratoFat, historicoFat, usFat, erroFat, type ContratoFat, type HistoricoFat } from '@/lib/faturamento';

export default function Contrato() {
  const { acesso } = useSessao();
  const admin = acesso?.papel === 'ADMIN';
  const [lista,setLista] = useState<ContratoFat[]>([]), [busca,setBusca] = useState(''), [tabela,setTabela] = useState('');
  const [erro,setErro] = useState(''),[carregando,setCarregando] = useState(true),[salvando,setSalvando] = useState(false);
  const [item,setItem] = useState<ContratoFat|null>(null),[historico,setHistorico] = useState<HistoricoFat[]>([]);
  async function carregar() { setCarregando(true); try { setLista(await contratosFat()); } catch(e) {setErro(erroFat(e));} finally {setCarregando(false);} }
  useEffect(()=>{void carregar();},[]);
  async function abrir(c:ContratoFat) { setItem(c);setHistorico([]);setErro('');if(admin)try {setHistorico(await historicoFat(c));} catch(e){setErro(erroFat(e));} }
  async function salvar(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();if(!item)return;const f=new FormData(e.currentTarget);setSalvando(true);setErro('');
    try {await acertarContratoFat(item,Number(f.get('csc')),Number(f.get('cod')),f.get('ativo')==='on',String(f.get('motivo')));setItem(null);await carregar();}
    catch(e){setErro(erroFat(e));}finally{setSalvando(false);}
  }
  return <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto">
    <div><h2 className="text-xl font-extrabold">Tabelas do contrato</h2><p className="text-sm text-aco">Tabela 11 · códigos de fechamento / Tabela 12 · atendimentos RC. Valores em US.</p></div>
    <p className="p-4 rounded-xl bg-sinal-fundo text-sinal text-sm">Os fatores publicados no contrato independem do valor pago na fatura. CSC/CSI e COD são comparados na Conferência. Códigos sem fator numérico validado permanecem pendentes.</p>
    {erro && <p role="alert" className="text-erro">{erro}</p>}
    <div className="flex gap-3"><input aria-label="Buscar código ou descrição" placeholder="Código ou descrição" value={busca} onChange={e=>setBusca(e.target.value)} className="border border-linha rounded-lg p-2 flex-1"/><select aria-label="Tabela" value={tabela} onChange={e=>setTabela(e.target.value)} className="border border-linha rounded-lg p-2"><option value="">Todas as tabelas</option><option>11</option><option>12</option></select></div>
    <div className="bg-white border border-linha rounded-2xl overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-nevoa"><tr>{['Tabela','Código','Descrição','CSC/CSI','COD','Validação'].map(h=><th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>
      {lista.filter(c=>(!tabela||c.tabela===tabela)&&`${c.codigo} ${c.descricao}`.toLowerCase().includes(busca.toLowerCase())).map(c=><tr key={c.tabela+c.codigo} className="border-t border-linha hover:bg-nevoa"><td className="p-3">{c.tabela}</td><td className="p-3 font-codigo"><button className="text-sinal underline" onClick={()=>void abrir(c)}>{c.codigo}</button></td><td className="p-3 max-w-md"><p className="line-clamp-2">{c.descricao}</p>{c.nota&&<span className="text-cobre">Com NOTA no contrato</span>}</td><td className="p-3 font-codigo">{usFat(c.fator_csc)}</td><td className="p-3 font-codigo">{usFat(c.fator_cod)}</td><td className="p-3">{!c.ativo?'Desativado':c.validado?'Validado':'A carregar manualmente'}</td></tr>)}
    </tbody></table>{carregando&&<p className="p-6">Carregando…</p>}{!carregando&&!lista.length&&<p className="p-6">Nenhum código carregado.</p>}</div>
    {item&&<div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={()=>!salvando&&setItem(null)}><section role="dialog" aria-modal="true" aria-label={`Código ${item.codigo}`} className="bg-white w-full max-w-xl p-6 overflow-auto space-y-4" onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setItem(null)} disabled={salvando} className="text-sinal">Fechar</button><h3 className="text-xl font-bold">Tabela {item.tabela} · {item.codigo}</h3><p className="whitespace-pre-line text-sm">{item.descricao}</p><p>Como lançar: {item.como_lancar??'Consultar descrição'}</p><p>Rural: {item.rural??'—'} · Moto: {item.moto??'—'}</p>{item.nota&&<p className="whitespace-pre-line text-cobre text-sm">{item.nota}</p>}
      <p className="text-xs text-aco">{item.origem}</p><p>Publicados: CSC {usFat(item.fator_original)} / COD {usFat(item.fator_cod_original)}</p>
      {admin&&<form onSubmit={salvar} className="space-y-3"><label className="block">Fator CSC/CSI<input name="csc" type="number" min="0" step="0.000001" required defaultValue={item.fator_csc??''} className="border rounded p-2 w-full"/></label><label className="block">Fator COD<input name="cod" type="number" min="0" step="0.000001" required defaultValue={item.fator_cod??''} className="border rounded p-2 w-full"/></label><label className="block"><input type="checkbox" name="ativo" defaultChecked={item.ativo}/> Ativo</label><label className="block">Motivo do acerto<textarea name="motivo" minLength={3} required className="border rounded p-2 w-full"/></label><button disabled={salvando} className="bg-sinal text-white rounded-lg px-4 py-2">{salvando?'Salvando…':'Salvar acerto'}</button></form>}
      {admin&&<div><h4 className="font-bold">Histórico</h4>{historico.map(h=><p key={h.id} className="text-sm border-t py-3">{new Date(h.data).toLocaleString('pt-BR')} · {h.motivo}<br/>CSC: {usFat(h.anterior.fator_csc)} → {usFat(h.novo.fator_csc)} · COD: {usFat(h.anterior.fator_cod)} → {usFat(h.novo.fator_cod)}<br/>Usuário: {h.usuario}</p>)}</div>}{erro&&<p role="alert" className="text-erro">{erro}</p>}
    </section></div>}
  </div>;
}
