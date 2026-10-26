import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gauge, ClipboardCheck, Receipt, MessageSquareWarning, Scale, ArrowRight, AlarmClockCheck } from 'lucide-react';
import { useSessao } from '@/contexto/Sessao';
import { temModulo } from '@/lib/neo';
import { getResumo, formatarUS, type ResumoFechamento } from '@/lib/fechamento';
import { getMedidoresMetrics, type DashboardMetrics } from '@/lib/api';

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

export default function Inicio() {
  const { cadastro, acesso, session, traceone } = useSessao();
  const veTraceone = temModulo(acesso, 'traceone');
  const veFechamento = temModulo(acesso, 'fechamento');
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [metricas, setMetricas] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    if (veFechamento) getResumo().then(setResumo).catch(() => setResumo(null));
    if (veTraceone && traceone === 'conectado') getMedidoresMetrics({ status: ['PENDENTE'] }).then(setMetricas).catch(() => setMetricas(null));
  }, [veFechamento, veTraceone, traceone]);

  const primeiroNome = (cadastro?.nome ?? session?.user.email ?? '').split(/[\s@]/)[0];
  const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <p className="text-sm font-semibold text-sinal">{saudacao()}, {primeiroNome}.</p>
        <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight mt-1">O que precisa fechar hoje</h2>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {temModulo(acesso, 'faturamento') && <Link to="/faturamento/painel" className="bg-white border border-linha rounded-2xl p-6 hover:border-sinal"><Receipt className="text-sinal"/><h3 className="text-lg font-extrabold mt-4">Faturamento</h3><p className="text-sm text-aco">Créditos e glosas CEMIG comparados com o contrato.</p></Link>}
        {veFechamento && (
          <Link to="/fechamento" className="group bg-white border border-linha rounded-2xl p-6 hover:border-sinal hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <span className="size-11 rounded-xl bg-sinal-fundo text-sinal flex items-center justify-center"><ClipboardCheck size={22} /></span>
              <ArrowRight size={18} className="text-aco-claro group-hover:text-sinal group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-lg font-extrabold mt-4">Manutenção</h3>
            <p className="text-sm text-aco">NSIS de manutenção: do GDIS até a fatura.</p>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <Mini rotulo="A fechar" valor={resumo?.etapas.A_FECHAR ?? '—'} cor="text-etapa-fechar" />
              <Mini rotulo="Gerar NSMP" valor={resumo?.etapas.AGUARDANDO_NSMP ?? (resumo ? 0 : '—')} cor="text-etapa-nsmp" />
              <Mini rotulo="Aguard. NSPR" valor={resumo?.etapas.AGUARDANDO_NSPR ?? (resumo ? 0 : '—')} cor="text-etapa-nspr" />
            </div>
            {resumo && resumo.divergentes > 0 && (
              <p className="mt-3 text-xs font-semibold text-cobre">{resumo.divergentes} NSIS com valor pago diferente do pedido</p>
            )}
            {resumo && (
              <p className="mt-1 text-xs text-aco">Pedido {formatarUS(resumo.valorPedido)} US · pago {formatarUS(resumo.valorPago)} US</p>
            )}
          </Link>
        )}

        {veTraceone && (
          <Link to="/traceone" className="group bg-white border border-linha rounded-2xl p-6 hover:border-sinal hover:shadow-md transition-all">
            <div className="flex items-start justify-between">
              <span className="size-11 rounded-xl bg-sinal-fundo text-sinal flex items-center justify-center"><Gauge size={22} /></span>
              <ArrowRight size={18} className="text-aco-claro group-hover:text-sinal group-hover:translate-x-0.5 transition-transform" />
            </div>
            <h3 className="text-lg font-extrabold mt-4">TraceOne · Medidores</h3>
            <p className="text-sm text-aco">Medidores entregues × serviços com baixa no GDIS.</p>
            <div className="grid grid-cols-3 gap-2 mt-5">
              <Mini rotulo="Pendentes" valor={metricas?.pendentes ?? '—'} cor="text-pendente" />
              <Mini rotulo="+45 dias" valor={metricas?.acima45dias ?? '—'} cor="text-erro" />
              <Mini rotulo="Valor pendente" valor={metricas ? brl(metricas.valorPendente) : '—'} cor="text-tinta" pequeno />
            </div>
            {metricas && metricas.acima45dias > 0 && (
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-erro">
                <AlarmClockCheck size={13} /> Veja a conferência +45 dias
              </span>
            )}
          </Link>
        )}
      </div>

      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-aco-claro mb-3">Próximas frentes do NEO</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { icone: MessageSquareWarning, nome: 'Notas de ouvidoria', texto: 'Acompanhamento das notas de ouvidoria.' },
            { icone: Scale, nome: 'Conciliação CEMIG', texto: 'O que foi enviado para pagamento × o que a CEMIG pagou.' },
          ].map(({ icone: Icone, nome, texto }) => (
            <div key={nome} className="border border-dashed border-linha rounded-2xl p-4 text-aco">
              <Icone size={18} className="text-aco-claro" />
              <p className="text-sm font-bold text-tinta/70 mt-2">{nome}</p>
              <p className="text-xs mt-0.5">{texto}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Mini({ rotulo, valor, cor, pequeno }: { rotulo: string; valor: number | string; cor: string; pequeno?: boolean }) {
  return (
    <div className="bg-nevoa rounded-xl px-3 py-2.5">
      <p className={`${pequeno ? 'text-base' : 'text-2xl'} font-extrabold ${cor}`}>{valor}</p>
      <p className="text-[11px] font-semibold text-aco">{rotulo}</p>
    </div>
  );
}
