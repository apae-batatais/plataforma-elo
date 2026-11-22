'use client';

/**
 * Ficha da requisição de materiais (com base no modelo usado hoje):
 * tipo, área, centros de custo com percentual, itens,
 * retirada ou entrega, evento (se houver), utensílios e observações.
 * Os dados ficam no navegador até o envio: um erro não apaga nada.
 */
import { startTransition, useActionState, useState, type FormEvent } from 'react';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { IconeLixeira, IconeMais } from '@/ui/icones';
import type { DadosRequisicao } from '../aplicacao/requisicoes';
import type { TipoAnexo } from '../dominio/anexos';
import { AnexosDaRequisicao, type AnexoNaFicha } from './anexos';
import type { ProjetoEscolhivel } from '../dominio/requisicao';
import type { OpcoesFicha, SaidaFicha } from './ficha';
import { FichaEspaco } from './ficha-espaco';
import { FichaManutencao } from './ficha-manutencao';
import { FichaMateriais } from './ficha-materiais';
import { FichaMobiliario } from './ficha-mobiliario';
import { FichaTi } from './ficha-ti';
import { FichaVeiculo } from './ficha-veiculo';

type Estado = { erro?: string };

export type { OpcoesFicha };

const vazioCentro = () => ({ servico: '', percentual: '' });
const paraNumero = (t: string) => (t.trim() === '' ? NaN : Number(t.replace(',', '.')));

export function FormularioRequisicao({
  opcoes,
  acao,
  inicial,
  oculto,
  rotuloEnviar = 'Enviar requisição',
  comComentario,
  iniciarEnvio,
  anexosIniciais = [],
}: {
  opcoes: OpcoesFicha;
  acao: (estado: Estado, f: FormData) => Promise<Estado>;
  inicial?: DadosRequisicao;
  oculto?: Record<string, string | number>;
  rotuloEnviar?: string;
  comComentario?: boolean;
  /** Abre o envio de uma foto ou vídeo (ação do servidor). */
  iniciarEnvio?: (a: { tipoId: string; tipo: TipoAnexo; mime: string; tamanho: number; duracao: number | null }) => Promise<{ url?: string; erro?: string }>;
  /** Anexos já guardados (ao ajustar uma requisição devolvida). */
  anexosIniciais?: AnexoNaFicha[];
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});
  const [tipoId, setTipoId] = useState(inicial?.tipoId ?? (opcoes.tipos.length === 1 ? opcoes.tipos[0].id : ''));
  const [area, setArea] = useState(inicial?.area ?? '');
  const [anexos, setAnexos] = useState<AnexoNaFicha[]>(anexosIniciais);
  const [centros, setCentros] = useState(
    inicial?.centros.map((c) => ({ servico: c.servico, percentual: String(c.percentual) })) ?? [{ servico: '', percentual: '100' }],
  );
  const [projetoId, setProjetoId] = useState(inicial?.projetoId ?? '');
  const [atividadeId, setAtividadeId] = useState(inicial?.atividadeId ?? '');
  const projeto = opcoes.projetos?.find((x) => x.id === projetoId);
  const servicoTravado = Boolean(projeto?.servico);
  const escolherProjeto = (id: string) => {
    setProjetoId(id);
    setAtividadeId('');
    const novo = opcoes.projetos?.find((x) => x.id === id);
    // O serviço vem do projeto (R3): um único centro de custo, 100%.
    if (novo?.servico) setCentros([{ servico: novo.servico, percentual: '100' }]);
  };
  // Dados do tipo escolhido: cada ficha devolve só os seus (itens e detalhes).
  const [saida, setSaida] = useState<SaidaFicha>({ itens: [], detalhes: {} });
  const [observacao, setObservacao] = useState(inicial?.observacao ?? '');

  const tipo = opcoes.tipos.find((t) => t.id === tipoId);
  const areasDoTipo = tipo?.areas.length ? opcoes.areas.filter((a) => tipo.areas.includes(a.codigo)) : opcoes.areas;
  const mudarTipo = (id: string) => {
    setTipoId(id);
    const t = opcoes.tipos.find((x) => x.id === id);
    if (!t) return;
    // Área que o tipo não aceita sai; se só há uma opção, ela já vem marcada.
    const areasOk = t.areas.length ? opcoes.areas.filter((a) => t.areas.includes(a.codigo)) : opcoes.areas;
    if (!areasOk.some((a) => a.codigo === area)) setArea(areasOk.length === 1 ? areasOk[0].codigo : '');
  };
  const soma = centros.reduce((s, c) => s + Math.round((paraNumero(c.percentual) || 0) * 100), 0) / 100;
  const areasDosServicos = [...new Set(opcoes.servicos.map((s) => s.areaNome))];

  const mudarCentro = (i: number, campo: 'servico' | 'percentual', valor: string) => {
    const novos = centros.map((c, k) => (k === i ? { ...c, [campo]: valor } : c));
    setCentros(novos);
    // Primeiro serviço escolhido sugere a área, se ela ainda estiver em branco.
    if (campo === 'servico' && !area) {
      const s = opcoes.servicos.find((x) => x.codigo === valor);
      if (s?.area && areasDoTipo.some((a) => a.codigo === s.area)) setArea(s.area);
    }
  };
  const dividirIgual = () => {
    const n = centros.length;
    const parte = Math.floor(10000 / n) / 100;
    setCentros(centros.map((c, i) => ({ ...c, percentual: String(i === n - 1 ? Math.round((100 - parte * (n - 1)) * 100) / 100 : parte) })));
  };

  const dados: DadosRequisicao = {
    tipoId,
    area,
    centros: saida.semCentros ? [] : centros.map((c) => ({ servico: c.servico, percentual: paraNumero(c.percentual) })),
    projetoId: projetoId || null,
    atividadeId: projetoId ? atividadeId || null : null,
    itens: saida.itens,
    detalhes: saida.detalhes,
    observacao,
    // Sem anexos neste tipo (ou desligados na instituição), não mexe nos que já existem.
    anexos:
      tipo?.anexos && opcoes.anexosAtivos
        ? anexos.filter((a) => a.arquivoId).map((a) => ({ arquivoId: a.arquivoId!, tipo: a.tipo, nome: a.nome, duracao: a.duracao }))
        : undefined,
  };
  const mostraAnexos = Boolean(tipo?.anexos && opcoes.anexosAtivos && iniciarEnvio);
  const enviandoArquivo = mostraAnexos && anexos.some((a) => !a.arquivoId && !a.erro);

  // Envio sem "action" no formulário: o React não limpa os campos, e um erro não apaga nada da tela.
  const enviarSemLimpar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    startTransition(() => enviar(f));
  };

  const blocoCentros = (
    <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Centros de custo</h2>
          <span className={`text-sm font-semibold tabular-nums ${soma === 100 ? 'text-sucesso' : 'text-aviso'}`}>Soma: {soma.toLocaleString('pt-BR')}%</span>
        </div>
        <p className="text-sm text-texto-suave">
          {servicoTravado ? 'O serviço vem do projeto.' : 'Um ou mais serviços da mesma coordenação, somando 100%.'}
        </p>
        <ul className="space-y-2">
          {centros.map((c, i) => (
            <li key={i} className="grid grid-cols-[1fr_7rem_auto] items-end gap-2">
              <label className="block text-sm">
                <span className="sr-only">Serviço {i + 1}</span>
                <select value={c.servico} disabled={servicoTravado} onChange={(e) => mudarCentro(i, 'servico', e.target.value)} className={`${estiloEntrada} !mt-0`}>
                  <option value="">Escolha o serviço…</option>
                  {areasDosServicos.map((a) => (
                    <optgroup key={a} label={a}>
                      {opcoes.servicos
                        .filter((s) => s.areaNome === a)
                        .map((s) => (
                          <option key={s.codigo} value={s.codigo}>
                            {s.nome}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="sr-only">Percentual do serviço {i + 1}</span>
                <span className="relative block">
                  <input
                    inputMode="decimal"
                    value={c.percentual}
                    readOnly={servicoTravado}
                    onChange={(e) => mudarCentro(i, 'percentual', e.target.value)}
                    className={`${estiloEntrada} !mt-0 pr-7 text-right`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-texto-suave">%</span>
                </span>
              </label>
              <Botao
                type="button"
                variante="icone"
                aria-label={`Tirar o centro ${i + 1}`}
                disabled={centros.length === 1}
                onClick={() => setCentros(centros.filter((_, k) => k !== i))}
              >
                <IconeLixeira tamanho={16} />
              </Botao>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          {!servicoTravado && (
            <Botao type="button" variante="fantasma" onClick={() => setCentros([...centros, vazioCentro()])}>
              <IconeMais tamanho={16} /> Outro centro de custo
            </Botao>
          )}
          {centros.length > 1 && (
            <Botao type="button" variante="fantasma" onClick={dividirIgual}>
              Dividir igualmente
            </Botao>
          )}
        </div>
      </section>
  );

  return (
    <form onSubmit={enviarSemLimpar} className="space-y-6">
      {oculto && Object.entries(oculto).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="dados" value={JSON.stringify(dados)} />

      <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
        <h2 className="text-lg font-bold">Pedido</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Tipo de requisição" obrigatorio dica={tipo?.descricao ?? undefined}>
            <select value={tipoId} onChange={(e) => mudarTipo(e.target.value)} disabled={Boolean(inicial)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {opcoes.tipos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Área" obrigatorio>
            <select value={area} onChange={(e) => setArea(e.target.value)} required className={estiloEntrada}>
              <option value="">Escolha…</option>
              {areasDoTipo.map((a) => (
                <option key={a.codigo} value={a.codigo}>
                  {a.nome}
                </option>
              ))}
            </select>
          </Campo>
        </div>
      </section>

      {opcoes.projetos && opcoes.projetos.length > 0 && (
        <section className="space-y-4 rounded-cartao border border-borda bg-superficie p-5">
          <h2 className="text-lg font-bold">Projeto</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Esta compra é de um projeto?" dica="Opcional. Só aparecem projetos em implementação que você pode ver.">
              <select value={projetoId} onChange={(e) => escolherProjeto(e.target.value)} className={estiloEntrada}>
                <option value="">Não é de um projeto</option>
                {opcoes.projetos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.codigo} · {x.titulo}
                  </option>
                ))}
              </select>
            </Campo>
            {projeto && (
              <Campo rotulo="Atividade" dica="A atividade é opcional; informe se quiser ver o gasto por atividade no projeto.">
                <select value={atividadeId} onChange={(e) => setAtividadeId(e.target.value)} className={estiloEntrada}>
                  <option value="">Sem atividade</option>
                  {projeto.atividades.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.descricao}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
        </section>
      )}

      {tipo?.formulario !== 'espaco' && blocoCentros}

      {/* Ficha própria do tipo: cada uma só conhece os campos do seu tipo. */}
      {tipo?.formulario === 'espaco' ? (
        <>
          <FichaEspaco key="espaco" inicial={inicial} tipo={tipo} espacos={opcoes.espacos} aoMudar={setSaida} />
          {/* Reserva: os centros vêm depois de "cessão para fora"; cedida para fora, não há centros. */}
          {!saida.semCentros && blocoCentros}
        </>
      ) : tipo?.formulario === 'veiculo' ? (
        <FichaVeiculo key="veiculo" inicial={inicial} tipo={tipo} veiculos={opcoes.veiculos} nomeDoUsuario={opcoes.nomeDoUsuario} aoMudar={setSaida} />
      ) : tipo?.formulario === 'ti' ? (
        <FichaTi key="ti" inicial={inicial} tipo={tipo} aoMudar={setSaida} />
      ) : tipo?.formulario === 'mobiliario' ? (
        <FichaMobiliario key="mobiliario" inicial={inicial} tipo={tipo} aoMudar={setSaida} />
      ) : tipo?.formulario === 'manutencao' ? (
        <FichaManutencao key="manutencao" inicial={inicial} tipo={tipo} aoMudar={setSaida} />
      ) : (
        <FichaMateriais key="materiais" inicial={inicial} tipo={tipo} aoMudar={setSaida} />
      )}

      {mostraAnexos && <AnexosDaRequisicao tipoId={tipoId} anexos={anexos} mudar={setAnexos} iniciar={iniciarEnvio!} />}

      <section className="space-y-3 rounded-cartao border border-borda bg-superficie p-5">
        <Campo rotulo="Observações">
          <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={estiloEntrada} />
        </Campo>
        {comComentario && (
          <Campo rotulo="O que você ajustou" dica="Aparece no histórico para a coordenação.">
            <textarea name="comentario" rows={2} className={estiloEntrada} />
          </Campo>
        )}
      </section>

      {estado.erro && (
        <Aviso tipo="erro" titulo="A requisição não foi enviada">
          {estado.erro}
        </Aviso>
      )}
      <BotaoEnviar pendente={enviando} disabled={enviandoArquivo} enviando="Enviando…">
        {enviandoArquivo ? 'Aguarde o envio das fotos e do vídeo…' : rotuloEnviar}
      </BotaoEnviar>
    </form>
  );
}
