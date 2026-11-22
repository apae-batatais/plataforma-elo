/** Portas de decisão: abrir, dar parecer, decidir (Diretoria e alçada), pendências e a ficha do projeto. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, ErroConflito, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { NOME_ITEM } from '../dominio/fases';
import { Decisoes, HistoricoProjetos, Pareceres, PedidosMudanca, Portas, Projetos, type RegDecisao, type RegHistorico, type RegParecer, type RegPorta, type RegProjeto } from '../dados/tabelas';
import {
  destinoDaDecisao,
  ErroProjetos,
  exigeAlcada,
  NOME_DECISAO,
  NOME_PARECER,
  parecerExigeTexto,
  pareceresExigidos,
  pareceresFaltando,
  podeDecidirPorta,
  RESULTADOS_PARECER,
  DECISOES,
  TIPOS_PARECER,
  type ConfigProjetos,
  type Decisao,
  type NivelDecisao,
  type ResultadoParecer,
  type TipoParecer,
  usaPortaDoPlano,
  type TipoPorta,
} from '../dominio/projeto';
import { aprovarTermo, conteudoDe, exigirTermoAprovado, lerFase } from './fases';
import { pedirRascunhoNaDecisao, type CatalogoTermos, type ResultadoRascunho } from './termo';
import { auditar, autoriaDe, designado, equipesAtivas, lerConfig, podeVerPareceres, podeVerProjeto, registrarHistorico, veTodos, type Opcoes } from './comum';

const exigidosDe = (porta: Pick<RegPorta, 'pareceres_exigidos'>): TipoParecer[] =>
  (porta.pareceres_exigidos ?? '').split(',').filter((t): t is TipoParecer => (TIPOS_PARECER as readonly string[]).includes(t));

/** Regras 6 e 8: o responsável abre a porta 1; o valor e a exigência de alçada ficam gravados. */
export async function abrirPorta(p: Planilhas, quem: Autorizador, projetoId: string, versao: number, opcoes: Opcoes = {}): Promise<{ portaId: string }> {
  const agora = opcoes.agora ?? new Date();
  const [projetos, config] = await Promise.all([lerTabelas(p, [Projetos] as const).then(([t]) => t), lerConfig(p)]);
  const r = projetos.porId(projetoId);
  if (!r || !r.ativo) throw new ErroProjetos('Projeto não encontrado.');
  if (r.versao !== versao) throw new ErroConflito(projetoId);
  if (!r.responsavel) throw new ErroProjetos('Ideia sem responsável não abre porta.');
  if (r.responsavel.toLowerCase() !== quem.email.toLowerCase() || !quem.temPermissaoAlgumEscopo('projetos.gerenciar')) throw new ErroPermissao('Só o responsável abre a porta.');
  if (r.etapa !== 'ideia' && r.etapa !== 'fase_2' && r.etapa !== 'fase_3') throw new ErroProjetos('Só uma ideia com responsável, ou um projeto com a fase 2 ou 3 pronta, abre porta de decisão.');
  if (!r.titulo.trim() || !r.resumo.trim()) throw new ErroProjetos('Preencha o título e o resumo antes de abrir a porta.');
  const tipoPorta: TipoPorta = r.etapa === 'ideia' ? 'ideia' : r.etapa === 'fase_2' ? 'termo' : 'plano';
  if (tipoPorta === 'plano' && !usaPortaDoPlano(r.porte)) throw new ErroProjetos('O porte enxuto não passa pela porta 3: inicie a implementação.');
  let valor = r.valor_estimado ?? 0;
  if (tipoPorta !== 'ideia') {
    // Regra 6: não se abre porta com documento exigido em branco.
    const fase = await lerFase(p, quem, r.id);
    const falta = fase?.itens.filter((i) => !i.pronto) ?? [];
    if (falta.length > 0) {
      const detalhe = falta.map((i) => (i.item === 'termo_abertura' && i.falta[0]?.startsWith('Informe') ? i.falta[0].replace(/\.$/, '').toLowerCase() : NOME_ITEM[i.item].toLowerCase()));
      throw new ErroProjetos(`Antes de abrir a porta ${tipoPorta === 'termo' ? 2 : 3}, complete: ${detalhe.join(', ')}.`);
    }
    if (tipoPorta === 'termo') {
      const termo = fase?.documentos.termo_abertura;
      const total = termo ? conteudoDe(termo).valor_total : null;
      valor = typeof total === 'number' ? total : valor;
    } else {
      // Regra de borda 4: da porta 2 em diante a alçada usa o valor aprovado.
      valor = r.valor_aprovado ?? valor;
    }
  }
  const exigidos = pareceresExigidos(config, r.porte);
  const campos = {
    projeto_id: r.id,
    tipo: tipoPorta,
    situacao: 'aberta' as const,
    valor_considerado: valor,
    exige_alcada: exigeAlcada(valor, config.limiteAlcada),
    pareceres_exigidos: exigidos.join(',') || null,
    aberta_em: agora.toISOString(),
    aberta_por: quem.email,
    resultado: null,
  };
  const porta = await inserir(p, Portas, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Portas', porta.id, Object.keys(campos), agora);
  const { colunasAlteradas } = await atualizar(p, Projetos, r.id, r.versao, { etapa: 'em_porta' }, autoriaDe(quem, agora));
  await auditar(p, quem, 'alteracao', 'Projetos', r.id, colunasAlteradas, agora);
  await registrarHistorico(p, quem, r.id, tipoPorta === 'ideia' ? 'Porta 1 aberta' : tipoPorta === 'termo' ? 'Porta 2 aberta (Termo de Abertura)' : 'Porta 3 aberta (plano)', campos.exige_alcada ? 'O valor passa do limite: a decisão sobe para a Presidência ou o Conselho.' : null, agora);
  return { portaId: porta.id };
}

async function lerPortaAberta(p: Planilhas, portaId: string) {
  const [portas, projetos, pareceres] = await lerTabelas(p, [Portas, Projetos, Pareceres] as const);
  const porta = portas.porId(portaId);
  if (!porta || !porta.ativo) throw new ErroProjetos('Porta não encontrada.');
  const projeto = projetos.porId(porta.projeto_id);
  if (!projeto || !projeto.ativo) throw new ErroProjetos('Projeto não encontrado.');
  return { porta, projeto, pareceres: pareceres.ativos().filter((x) => x.porta_id === portaId) };
}

/** Regra 9: parecer só por quem foi designado para o tipo, uma vez por porta; ressalvas e insatisfatório exigem texto. */
export async function darParecer(p: Planilhas, quem: Autorizador, portaId: string, tipo: TipoParecer, resultado: ResultadoParecer, texto: string | null, opcoes: Opcoes = {}): Promise<void> {
  const agora = opcoes.agora ?? new Date();
  if (!quem.temPermissaoAlgumEscopo('projetos.parecer')) throw new ErroPermissao();
  const config = await lerConfig(p);
  if (!designado(config, quem.email, tipo)) throw new ErroPermissao(`Você não foi designado para o parecer ${NOME_PARECER[tipo].toLowerCase()}.`);
  if (!(RESULTADOS_PARECER as readonly string[]).includes(resultado)) throw new ErroProjetos('Escolha o resultado do parecer.');
  const { porta, projeto, pareceres } = await lerPortaAberta(p, portaId);
  if (porta.situacao !== 'aberta') throw new ErroProjetos('Esta porta não está recebendo pareceres.');
  if (!exigidosDe(porta).includes(tipo)) throw new ErroProjetos(`Esta porta não exige parecer ${NOME_PARECER[tipo].toLowerCase()}.`);
  if (pareceres.some((x) => x.tipo === tipo)) throw new ErroProjetos(`O parecer ${NOME_PARECER[tipo].toLowerCase()} já foi dado nesta porta.`);
  const t = texto?.trim() || null;
  if (parecerExigeTexto(resultado) && !t) throw new ErroProjetos('Explique o parecer: com ressalvas ou insatisfatório pedem texto.');
  const campos = { porta_id: porta.id, projeto_id: projeto.id, tipo, parecerista: quem.email, resultado, texto: t, em: agora.toISOString() };
  const novo = await inserir(p, Pareceres, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Pareceres', novo.id, Object.keys(campos), agora);
  // O histórico mostra o resultado, nunca o texto do parecer.
  await registrarHistorico(p, quem, projeto.id, `Parecer ${NOME_PARECER[tipo].toLowerCase()} dado`, null, agora);
}

/**
 * Regras 10 a 12. Porta aberta: decide a Diretoria (todos os pareceres dados). Porta aguardando alçada:
 * decide quem a configuração designou para a alçada.
 */
export async function decidirPorta(p: Planilhas, quem: Autorizador, portaId: string, versaoPorta: number, decisao: Decisao, justificativa: string, opcoes: Opcoes & { parcerias?: CatalogoTermos | null } = {}): Promise<{ rascunho: ResultadoRascunho }> {
  const agora = opcoes.agora ?? new Date();
  const config = await lerConfig(p);
  const { porta, projeto, pareceres } = await lerPortaAberta(p, portaId);
  if (porta.versao !== versaoPorta) throw new ErroConflito(porta.id);
  if (!(DECISOES as readonly string[]).includes(decisao)) throw new ErroProjetos('Escolha seguir, ajustar ou parar.');
  if (porta.situacao === 'decidida') throw new ErroProjetos('Esta porta já foi decidida.');
  const nivel: NivelDecisao = porta.situacao === 'aberta' ? 'diretoria' : 'alcada';
  if (nivel === 'diretoria') {
    if (!quem.temPermissao('projetos.decidir')) throw new ErroPermissao('Só a Diretoria decide esta porta.');
    const falta = pareceresFaltando(exigidosDe(porta), pareceres.map((x) => x.tipo));
    if (falta.length > 0) throw new ErroProjetos(`Faltam pareceres: ${falta.map((t) => NOME_PARECER[t].toLowerCase()).join(', ')}.`);
  } else if (!quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') || !designado(config, quem.email, 'alcada')) {
    throw new ErroPermissao('Só a Presidência ou o Conselho, designados na configuração, decidem acima do limite.');
  }
  if (!podeDecidirPorta(quem.email, projeto.proponente, config)) throw new ErroPermissao('Quem propôs a ideia não decide a própria porta.');
  const j = justificativa.trim();
  if (!j) throw new ErroProjetos('Escreva a justificativa da decisão.');

  const destino = destinoDaDecisao(nivel, decisao, porta.exige_alcada, porta.tipo);
  // Regra 13: sem Termo aprovado, nada entra em implementação.
  if (porta.tipo === 'plano' && destino.etapa === 'implementacao') await exigirTermoAprovado(p, projeto.id);
  const campos = { porta_id: porta.id, projeto_id: projeto.id, nivel, decisor: quem.email, decisao, justificativa: j, em: agora.toISOString() };
  const nova = await inserir(p, Decisoes, campos, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'Decisoes', nova.id, Object.keys(campos), agora);
  const { colunasAlteradas } = await atualizar(
    p,
    Portas,
    porta.id,
    porta.versao,
    { situacao: destino.situacaoPorta, resultado: destino.situacaoPorta === 'decidida' ? decisao : null },
    autoriaDe(quem, agora),
  );
  await auditar(p, quem, 'alteracao', 'Portas', porta.id, colunasAlteradas, agora);
  if (destino.etapa) {
    const r = await atualizar(p, Projetos, projeto.id, projeto.versao, { etapa: destino.etapa }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'Projetos', projeto.id, r.colunasAlteradas, agora);
  }
  // Regra 13: "seguir" final na porta 2 aprova o Termo de Abertura e grava o valor aprovado.
  if (porta.tipo === 'termo' && destino.etapa === 'fase_3') await aprovarTermo(p, quem, projeto.id, agora);
  const quemDecidiu = nivel === 'alcada' ? 'Presidência ou Conselho' : 'Diretoria';
  await registrarHistorico(p, quem, projeto.id, `${quemDecidiu}: ${NOME_DECISAO[decisao].toLowerCase()}`, j, agora);
  // Regras L8 e L9: projeto financiado ganha o rascunho do termo; se falhar, a decisão continua valendo.
  const rascunho: ResultadoRascunho =
    porta.tipo === 'termo' && destino.etapa === 'fase_3' ? await pedirRascunhoNaDecisao(p, quem, projeto.id, opcoes.parcerias, agora) : { estado: 'nao_se_aplica' };
  return { rascunho };
}

export interface PendenciaProjetos {
  /** Porta ou pedido de mudança que espera a pessoa (serve de chave na lista). */
  portaId: string;
  projetoId: string;
  codigo: string;
  titulo: string;
  /** O que espera esta pessoa. */
  acao: 'parecer' | 'decisao' | 'alcada' | 'mudanca' | 'mudanca_alcada';
  detalhe: string;
}

/** O que espera a pessoa: pareceres que ela pode dar e decisões que ela pode tomar. */
export async function pendenciasDe(p: Planilhas, quem: Autorizador): Promise<PendenciaProjetos[]> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) return [];
  const config = await lerConfig(p);
  const [portas, projetos, pareceres] = await lerTabelas(p, [Portas, Projetos, Pareceres] as const);
  const saida: PendenciaProjetos[] = [];
  for (const porta of portas.ativos().filter((x) => x.situacao !== 'decidida')) {
    const projeto = projetos.porId(porta.projeto_id);
    if (!projeto || !projeto.ativo) continue;
    const base = { portaId: porta.id, projetoId: projeto.id, codigo: projeto.codigo, titulo: projeto.titulo };
    const dados = pareceres.ativos().filter((x) => x.porta_id === porta.id).map((x) => x.tipo);
    if (porta.situacao === 'aberta') {
      if (quem.temPermissaoAlgumEscopo('projetos.parecer')) {
        for (const tipo of exigidosDe(porta)) {
          if (!dados.includes(tipo) && designado(config, quem.email, tipo)) saida.push({ ...base, acao: 'parecer', detalhe: `Parecer ${NOME_PARECER[tipo].toLowerCase()}` });
        }
      }
      if (quem.temPermissao('projetos.decidir') && podeDecidirPorta(quem.email, projeto.proponente, config) && pareceresFaltando(exigidosDe(porta), dados).length === 0) {
        saida.push({ ...base, acao: 'decisao', detalhe: 'Decisão da Diretoria' });
      }
    } else if (quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') && designado(config, quem.email, 'alcada') && podeDecidirPorta(quem.email, projeto.proponente, config)) {
      saida.push({ ...base, acao: 'alcada', detalhe: 'Decisão da Presidência ou do Conselho' });
    }
  }
  // Pedidos de mudança fora da tolerância (P4): a Diretoria e, acima do limite, a Presidência ou o Conselho.
  const [pedidos] = await lerTabelas(p, [PedidosMudanca] as const);
  for (const x of pedidos.ativos().filter((y) => y.situacao === 'pendente' || y.situacao === 'aguardando_alcada')) {
    const projeto = projetos.porId(x.projeto_id);
    if (!projeto || !projeto.ativo || projeto.etapa !== 'implementacao' || x.pedido_por.toLowerCase() === quem.email.toLowerCase()) continue;
    const base = { portaId: x.id, projetoId: projeto.id, codigo: projeto.codigo, titulo: projeto.titulo };
    if (x.situacao === 'pendente' && quem.temPermissao('projetos.decidir')) saida.push({ ...base, acao: 'mudanca', detalhe: 'Pedido de mudança fora da tolerância' });
    if (x.situacao === 'aguardando_alcada' && quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') && designado(config, quem.email, 'alcada')) saida.push({ ...base, acao: 'mudanca_alcada', detalhe: 'Pedido de mudança: decisão da Presidência ou do Conselho' });
  }
  return saida;
}

export interface PortaDetalhe {
  porta: RegPorta;
  exigidos: TipoParecer[];
  faltando: TipoParecer[];
  /** Texto dos pareceres: só para quem pode ver; os demais veem só o resultado (regra do app). */
  pareceres: { tipo: TipoParecer; resultado: ResultadoParecer; parecerista: string | null; texto: string | null; em: string }[];
  decisoes: RegDecisao[];
}

export interface FichaProjeto {
  projeto: RegProjeto;
  portas: PortaDetalhe[];
  historico: RegHistorico[];
  config: ConfigProjetos;
  /** O que a pessoa pode fazer agora (a tela só mostra estes botões; as regras valem de novo ao gravar). */
  pode: {
    editar: boolean;
    enviar: boolean;
    assumir: boolean;
    abrirPorta: boolean;
    trocarResponsavel: boolean;
    retomar: boolean;
    cancelar: boolean;
    parecerDos: TipoParecer[];
    decidir: boolean;
    decidirAlcada: boolean;
  };
}

/** Regra "quem vê o quê": devolve null se a pessoa não vê o projeto. */
export async function lerFicha(p: Planilhas, quem: Autorizador, id: string): Promise<FichaProjeto | null> {
  if (!quem.temPermissaoAlgumEscopo('projetos.acessar')) throw new ErroPermissao();
  const config = await lerConfig(p);
  const [[projetos, portas, pareceres, decisoes, historico], equipes] = await Promise.all([lerTabelas(p, [Projetos, Portas, Pareceres, Decisoes, HistoricoProjetos] as const), equipesAtivas(p)]);
  const projeto = projetos.porId(id);
  if (!projeto || !projeto.ativo || !podeVerProjeto(quem, projeto, config, equipes.get(projeto.id))) return null;
  const eu = quem.email.toLowerCase();
  const ehResponsavel = projeto.responsavel?.toLowerCase() === eu;
  const ehProponente = projeto.proponente.toLowerCase() === eu;
  const verTextos = podeVerPareceres(quem, projeto, config);

  const detalhes: PortaDetalhe[] = portas
    .ativos()
    .filter((x) => x.projeto_id === id)
    .sort((a, b) => a.aberta_em.localeCompare(b.aberta_em))
    .map((porta) => {
      const dados = pareceres.ativos().filter((x) => x.porta_id === porta.id);
      const exigidos = exigidosDe(porta);
      return {
        porta,
        exigidos,
        faltando: pareceresFaltando(exigidos, dados.map((x) => x.tipo)),
        // Quem não pode ver pareceres vê só as decisões (resultado e justificativa), nunca o parecer.
        pareceres: verTextos
          ? dados.map((x: RegParecer) => ({ tipo: x.tipo, resultado: x.resultado, parecerista: x.parecerista, texto: x.texto, em: x.em }))
          : [],
        decisoes: decisoes.ativos().filter((x) => x.porta_id === porta.id),
      };
    });
  const aberta = detalhes.find((d) => d.porta.situacao !== 'decidida');
  const podeDecidir = !!aberta && podeDecidirPorta(quem.email, projeto.proponente, config);
  return {
    projeto,
    portas: detalhes,
    historico: historico.todos().filter((x) => x.projeto_id === id).sort((a, b) => a.em.localeCompare(b.em)),
    config,
    pode: {
      editar:
        (ehProponente && (projeto.etapa === 'rascunho' || projeto.etapa === 'aguardando_responsavel')) ||
        (ehResponsavel && projeto.etapa === 'ideia' && quem.temPermissaoAlgumEscopo('projetos.gerenciar')),
      enviar: ehProponente && projeto.etapa === 'rascunho',
      assumir: projeto.etapa === 'aguardando_responsavel' && quem.temPermissaoAlgumEscopo('projetos.gerenciar') && (projeto.servico ? quem.temPermissao('projetos.assumir', { tipo: 'servico', codigo: projeto.servico }) : quem.temPermissaoAlgumEscopo('projetos.assumir')),
      abrirPorta: ehResponsavel && projeto.etapa === 'ideia' && quem.temPermissaoAlgumEscopo('projetos.gerenciar'),
      trocarResponsavel: veTodos(quem) && ['ideia', 'fase_1', 'fase_2', 'fase_3', 'implementacao', 'parado'].includes(projeto.etapa),
      retomar: projeto.etapa === 'parado' && quem.temPermissao('projetos.decidir'),
      cancelar: projeto.etapa !== 'cancelado' && projeto.etapa !== 'encerrado' && projeto.etapa !== 'em_porta' && ((ehProponente && (projeto.etapa === 'rascunho' || projeto.etapa === 'aguardando_responsavel')) || ehResponsavel || veTodos(quem)),
      parecerDos:
        aberta && aberta.porta.situacao === 'aberta' && quem.temPermissaoAlgumEscopo('projetos.parecer')
          ? aberta.faltando.filter((t) => designado(config, quem.email, t))
          : [],
      decidir: !!aberta && aberta.porta.situacao === 'aberta' && aberta.faltando.length === 0 && quem.temPermissao('projetos.decidir') && podeDecidir,
      decidirAlcada: !!aberta && aberta.porta.situacao === 'aguardando_alcada' && quem.temPermissaoAlgumEscopo('projetos.decidir_alcada') && designado(config, quem.email, 'alcada') && podeDecidir,
    },
  };
}
