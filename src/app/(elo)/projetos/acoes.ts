'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { salvarConfig } from '@/modulos/projetos/aplicacao/configuracoes';
import { assumirIdeia, cadastrarIdeia, cancelarProjeto, editarIdeia, enviarParaAssumir, retomarProjeto, trocarResponsavel, type DadosIdeia } from '@/modulos/projetos/aplicacao/ideias';
import {
  adicionarItemMarco,
  adicionarMembro,
  alterarItemMarco,
  avancarFase,
  encerrarMembro,
  encerrarRisco,
  iniciarImplementacao,
  registrarRisco,
  retirarItemMarco,
  salvarDocumento,
} from '@/modulos/projetos/aplicacao/fases';
import { decidirMudanca, enviarRelatorio, pedirMudanca, registrarProblema, resolverProblema } from '@/modulos/projetos/aplicacao/acompanhamento';
import { SITUACOES_RELATORIO, TIPOS_MUDANCA, type SituacaoRelatorio, type TipoMudanca } from '@/modulos/projetos/dominio/acompanhamento';
import {
  adicionarAtividade,
  adicionarLinhaOrcamento,
  alterarAtividade,
  alterarLinhaOrcamento,
  mudarSituacaoAtividade,
  retirarAtividade,
  retirarLinhaOrcamento,
} from '@/modulos/projetos/aplicacao/planejamento';
import { SITUACOES_ATIVIDADE, type SituacaoAtividade } from '@/modulos/projetos/dominio/planejamento';
import { definirFonteDoItem, registrarMedicao } from '@/modulos/projetos/aplicacao/indicadores';
import { FONTES_NUMERO, type FonteNumero } from '@/modulos/projetos/dominio/indicadores';
import { abrirPortaDeEncerramento, iniciarEncerramento, marcarChecklist, registrarLicao, salvarTextoDeEncerramento } from '@/modulos/projetos/aplicacao/encerramento';
import { CATEGORIAS_LICAO, ITENS_CHECKLIST, ITENS_TEXTO, type CategoriaLicao, type ItemChecklist, type ItemTexto } from '@/modulos/projetos/dominio/encerramento';
import { abrirPorta, darParecer, decidirPorta } from '@/modulos/projetos/aplicacao/portas';
import { lancarReceitaDoEvento, type ResultadoReceita } from '@/modulos/projetos/aplicacao/evento';
import { criarRascunhoDoProjeto, type ResultadoRascunho } from '@/modulos/projetos/aplicacao/termo';
import { GRAUS, NIVEIS_MARCO, TIPOS_DOCUMENTO, type Grau, type NivelMarco, type TipoDocumento } from '@/modulos/projetos/dominio/fases';
import {
  DECISOES,
  ErroProjetos,
  lerEmails,
  PAPEIS_DESIGNADOS,
  PORTES,
  RESULTADOS_PARECER,
  TIPOS_PARECER,
  TIPOS_PROJETO,
  type Decisao,
  type Porte,
  type ResultadoParecer,
  type TipoParecer,
  type TipoProjeto,
} from '@/modulos/projetos/dominio/projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { catalogoDeReceitas, catalogoDeTermos, leitorDeResultado } from '@/plataforma/ligacoes';
import { esquecerAlertas } from '@/plataforma/alertas';
import { numerosDePessoas } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroProjetos || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const comMensagem = (pagina: string, chave: 'ok' | 'erro', mensagem: string) => `${pagina}${pagina.includes('?') ? '&' : '?'}${chave}=${encodeURIComponent(mensagem)}`;

/** Executa e volta para a página com a mensagem no endereço (a notificação lê ?ok= e ?erro=). */
async function executar(pagina: (resultado: unknown) => string, erroEm: string, sucesso: string | ((resultado: unknown) => { chave: 'ok' | 'erro'; mensagem: string }), acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  try {
    const resultado = await acao(ctx);
    const aviso = typeof sucesso === 'string' ? { chave: 'ok' as const, mensagem: sucesso } : sucesso(resultado);
    destino = comMensagem(pagina(resultado), aviso.chave, aviso.mensagem);
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = comMensagem(erroEm, 'erro', (erro as Error).message);
  }
  esquecerAlertas();
  revalidatePath('/', 'layout');
  redirect(destino);
}

function lerIdeia(f: FormData): DadosIdeia {
  const v = texto(f, 'valor').replace(/\./g, '').replace(',', '.');
  const tipo = texto(f, 'tipo');
  const porte = texto(f, 'porte');
  return {
    titulo: texto(f, 'titulo'),
    resumo: texto(f, 'resumo'),
    tipo: (TIPOS_PROJETO as readonly string[]).includes(tipo) ? (tipo as TipoProjeto) : ('' as TipoProjeto),
    porte: (PORTES as readonly string[]).includes(porte) ? (porte as Porte) : ('' as Porte),
    valorEstimado: v === '' ? null : Number(v),
    servico: texto(f, 'servico') || null,
    evento:
      tipo === 'captacao'
        ? {
            serie: texto(f, 'serie') || null,
            dataEvento: texto(f, 'data_evento') || null,
            metaReceita: texto(f, 'meta_receita') === '' ? null : Number(texto(f, 'meta_receita').replace(/\./g, '').replace(',', '.')),
            fonteReceitaId: texto(f, 'fonte_receita') || null,
          }
        : undefined,
  };
}

const numeroDe = (f: FormData, campo: string) => {
  const t = texto(f, campo).replace(/\./g, '').replace(',', '.');
  return t === '' ? 0 : Number(t);
};
const fichaDe = (id: string, parte = '') => `/projetos/${id}${parte}`;
const ficha = (id: string) => `/projetos/${id}`;

export async function acaoSalvarIdeia(f: FormData) {
  const id = texto(f, 'id');
  const dados = lerIdeia(f);
  if (id) {
    await executar(() => ficha(id), ficha(id), 'Ideia salva.', async ({ usuario, app }) => {
      await editarIdeia(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), dados, { receitas: catalogoDeReceitas(app.planilhas) });
      if (texto(f, 'enviar') === 'sim') await enviarParaAssumir(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')) + 1);
    });
    return;
  }
  const enviar = texto(f, 'enviar') === 'sim';
  await executar(
    (r) => ficha((r as { id: string }).id),
    dados.tipo === 'captacao' ? '/projetos/nova?tipo=captacao' : '/projetos/nova',
    enviar ? 'Ideia enviada. Uma coordenação vai assumir como responsável.' : 'Rascunho salvo.',
    ({ usuario, app }) => cadastrarIdeia(app.planilhas, usuario.autorizador, dados, { enviar, receitas: catalogoDeReceitas(app.planilhas) }),
  );
}

export async function acaoEnviarIdeia(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), ficha(id), 'Ideia enviada para uma coordenação assumir.', ({ usuario, app }) => enviarParaAssumir(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

export async function acaoAssumirIdeia(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), texto(f, 'volta') || ficha(id), 'Você é a pessoa responsável por esta ideia.', ({ usuario, app }) => assumirIdeia(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

export async function acaoTrocarResponsavel(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), ficha(id), 'Responsável trocado.', ({ usuario, app }) => trocarResponsavel(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'responsavel')));
}

export async function acaoRetomarProjeto(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), ficha(id), 'Projeto retomado. O responsável pode abrir uma nova porta 1.', ({ usuario, app }) => retomarProjeto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

export async function acaoCancelarProjeto(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), ficha(id), 'Projeto cancelado. Ele continua guardado.', ({ usuario, app }) => cancelarProjeto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo'), { orcamento: catalogoDeReceitas(app.planilhas) }));
}

export async function acaoAbrirPorta(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => ficha(id), ficha(id), 'Porta aberta. Agora esperam os pareceres.', ({ usuario, app }) => abrirPorta(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

export async function acaoDarParecer(f: FormData) {
  const id = texto(f, 'id');
  const tipo = texto(f, 'tipo');
  const resultado = texto(f, 'resultado');
  await executar(
    () => ficha(id),
    ficha(id),
    'Parecer registrado.',
    ({ usuario, app }) =>
      darParecer(app.planilhas, usuario.autorizador, texto(f, 'porta'), (TIPOS_PARECER as readonly string[]).includes(tipo) ? (tipo as TipoParecer) : ('' as TipoParecer), (RESULTADOS_PARECER as readonly string[]).includes(resultado) ? (resultado as ResultadoParecer) : ('' as ResultadoParecer), texto(f, 'texto') || null),
  );
}

export async function acaoDecidirPorta(f: FormData) {
  const id = texto(f, 'id');
  const decisao = texto(f, 'decisao');
  await executar(
    () => ficha(id),
    ficha(id),
    (r) => {
      const rascunho = (r as { rascunho: ResultadoRascunho }).rascunho;
      const receita = (r as { receita: ResultadoReceita }).receita;
      if (receita.estado === 'pendente') return { chave: 'erro', mensagem: `A decisão foi registrada, mas a receita do evento não entrou no Orçamento (${receita.motivo}). Veja a aba Ligações.` };
      if (receita.estado === 'criada') return { chave: 'ok', mensagem: 'Decisão registrada e receita "A captar" lançada no Orçamento.' };
      if (rascunho.estado === 'criado') return { chave: 'ok', mensagem: 'Decisão registrada e rascunho do termo criado.' };
      if (rascunho.estado === 'falhou') return { chave: 'erro', mensagem: `A decisão foi registrada, mas o rascunho do termo não foi criado (${rascunho.motivo}). Use "Criar rascunho do termo" na aba Ligações.` };
      return { chave: 'ok', mensagem: 'Decisão registrada.' };
    },
    ({ usuario, app }) =>
      decidirPorta(app.planilhas, usuario.autorizador, texto(f, 'porta'), Number(texto(f, 'versao_porta')), (DECISOES as readonly string[]).includes(decisao) ? (decisao as Decisao) : ('' as Decisao), texto(f, 'justificativa'), {
        parcerias: catalogoDeTermos(app.planilhas),
        orcamento: catalogoDeReceitas(app.planilhas),
        resultado: leitorDeResultado(app.planilhas),
      }),
  );
}

export async function acaoCriarRascunhoDoTermo(f: FormData) {
  const id = texto(f, 'id');
  const volta = `${ficha(id)}/ligacoes`;
  await executar(
    () => volta,
    volta,
    (r) => ({ chave: 'ok', mensagem: (r as { criado: boolean }).criado ? 'Rascunho do termo criado em Parcerias.' : 'O rascunho do termo já existia; nada foi duplicado.' }),
    ({ usuario, app }) => criarRascunhoDoProjeto(app.planilhas, usuario.autorizador, id, catalogoDeTermos(app.planilhas)),
  );
}

export async function acaoLancarReceitaDoEvento(f: FormData) {
  const id = texto(f, 'id');
  const volta = `${ficha(id)}/ligacoes`;
  await executar(
    () => volta,
    volta,
    (r) => ({ chave: 'ok', mensagem: (r as { criada: boolean }).criada ? 'Receita "A captar" lançada no Orçamento.' : 'A receita já estava no Orçamento; nada foi duplicado.' }),
    ({ usuario, app }) => lancarReceitaDoEvento(app.planilhas, usuario.autorizador, id, catalogoDeReceitas(app.planilhas), { fonteId: texto(f, 'fonte_receita') || null }),
  );
}

export async function acaoSalvarConfig(f: FormData) {
  const limite = texto(f, 'limite').replace(/\./g, '').replace(',', '.');
  const versoes = JSON.parse(texto(f, 'versoes') || '{}') as Record<string, number>;
  await executar(
    () => '/projetos/configuracoes',
    '/projetos/configuracoes',
    'Configurações salvas.',
    ({ usuario, app }) => {
      const pareceres = (porte: string) => f.getAll(`pareceres_${porte}`).map(String).filter((t): t is TipoParecer => (TIPOS_PARECER as readonly string[]).includes(t));
      return salvarConfig(
        app.planilhas,
        usuario.autorizador,
        {
          limiteAlcada: limite === '' ? null : Number(limite),
          pareceresPorta1: { completo: pareceres('completo'), enxuto: pareceres('enxuto') },
          designados: Object.fromEntries(PAPEIS_DESIGNADOS.map((papel) => [papel, lerEmails(texto(f, `designados_${papel}`))])) as never,
          proponenteDecide: texto(f, 'proponente_decide') === 'sim',
          tolerancias: {
            custoLinhaPct: numeroDe(f, 'tol_custo_linha'),
            custoTotalPct: numeroDe(f, 'tol_custo_total'),
            prazoFimDias: numeroDe(f, 'tol_prazo_fim'),
            prazoMarcoDias: numeroDe(f, 'tol_prazo_marco'),
          },
        },
        { versoes },
      );
    },
  );
}

const lista = <T extends string>(valores: readonly T[], v: string): T => ((valores as readonly string[]).includes(v) ? (v as T) : ('' as T));

export async function acaoSalvarDocumento(f: FormData) {
  const id = texto(f, 'id');
  const tipo = lista<TipoDocumento>(TIPOS_DOCUMENTO, texto(f, 'tipo'));
  const pronto = texto(f, 'pronto') === 'sim';
  const conteudo = Object.fromEntries([...f.entries()].filter(([k]) => k.startsWith('c_')).map(([k, v]) => [k.slice(2), String(v)]));
  const versaoDoc = texto(f, 'versao_doc');
  await executar(
    () => fichaDe(id),
    fichaDe(id, `/fase/${tipo}`),
    pronto ? 'Documento salvo e marcado como pronto.' : 'Rascunho salvo.',
    ({ usuario, app }) => salvarDocumento(app.planilhas, usuario.autorizador, id, tipo, conteudo, pronto, versaoDoc === '' ? null : Number(versaoDoc)),
  );
}

export async function acaoAvancarFase(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => fichaDe(id), fichaDe(id), 'Fase 1 concluída. O projeto está na fase 2.', ({ usuario, app }) => avancarFase(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

function lerItemMarco(f: FormData) {
  return {
    nivel: lista<NivelMarco>(NIVEIS_MARCO, texto(f, 'nivel')),
    descricao: texto(f, 'descricao'),
    indicador: texto(f, 'indicador') || null,
    fonteVerificacao: texto(f, 'fonte') || null,
    pressuposto: texto(f, 'pressuposto') || null,
    acima: texto(f, 'acima') || null,
  };
}

export async function acaoSalvarItemMarco(f: FormData) {
  const id = texto(f, 'id');
  const item = texto(f, 'item');
  const volta = fichaDe(id, '/marco-logico');
  if (item) {
    await executar(() => volta, volta, 'Item alterado.', ({ usuario, app }) => alterarItemMarco(app.planilhas, usuario.autorizador, id, item, Number(texto(f, 'versao_item')), lerItemMarco(f)));
    return;
  }
  await executar(() => volta, volta, 'Item incluído.', ({ usuario, app }) => adicionarItemMarco(app.planilhas, usuario.autorizador, id, lerItemMarco(f)));
}

export async function acaoRetirarItemMarco(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/marco-logico');
  await executar(() => volta, volta, 'Item retirado. Ele continua guardado.', ({ usuario, app }) => retirarItemMarco(app.planilhas, usuario.autorizador, id, texto(f, 'item'), Number(texto(f, 'versao_item'))));
}

export async function acaoFonteDoItem(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/marco-logico');
  const fonte = texto(f, 'fonte') as FonteNumero;
  const meta = texto(f, 'meta').replace(',', '.');
  await executar(() => volta, volta, 'Fonte do número salva.', ({ usuario, app }) =>
    definirFonteDoItem(app.planilhas, usuario.autorizador, id, texto(f, 'item'), Number(texto(f, 'versao_item')), {
      fonte: FONTES_NUMERO.includes(fonte) ? fonte : 'manual',
      servico: texto(f, 'servico') || null,
      meta: meta === '' ? null : Number(meta),
    }),
  );
}

export async function acaoRegistrarMedicao(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/marco-logico');
  await executar(() => volta, volta, 'Medição registrada.', ({ usuario, app }) => registrarMedicao(app.planilhas, usuario.autorizador, id, numerosDePessoas(app.planilhas)));
}

export async function acaoRegistrarRisco(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/riscos');
  await executar(() => volta, volta, 'Risco registrado.', ({ usuario, app }) =>
    registrarRisco(app.planilhas, usuario.autorizador, id, {
      descricao: texto(f, 'descricao'),
      probabilidade: lista<Grau>(GRAUS, texto(f, 'probabilidade')),
      impacto: lista<Grau>(GRAUS, texto(f, 'impacto')),
      resposta: texto(f, 'resposta') || null,
      dono: texto(f, 'dono') || null,
    }),
  );
}

export async function acaoEncerrarRisco(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/riscos');
  await executar(() => volta, volta, 'Risco encerrado.', ({ usuario, app }) => encerrarRisco(app.planilhas, usuario.autorizador, id, texto(f, 'risco'), Number(texto(f, 'versao_risco'))));
}

export async function acaoAdicionarMembro(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/equipe');
  await executar(() => volta, volta, 'Pessoa incluída na equipe.', ({ usuario, app }) => adicionarMembro(app.planilhas, usuario.autorizador, id, texto(f, 'email'), texto(f, 'funcao')));
}

export async function acaoEncerrarMembro(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/equipe');
  await executar(() => volta, volta, 'Participação encerrada.', ({ usuario, app }) => encerrarMembro(app.planilhas, usuario.autorizador, id, texto(f, 'membro'), Number(texto(f, 'versao_membro'))));
}

export async function acaoIniciarImplementacao(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => fichaDe(id), fichaDe(id), 'Implementação iniciada.', ({ usuario, app }) => iniciarImplementacao(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
}

function lerAtividade(f: FormData) {
  return {
    descricao: texto(f, 'descricao'),
    responsavel: texto(f, 'responsavel'),
    inicioPrevisto: texto(f, 'inicio'),
    fimPrevisto: texto(f, 'fim'),
    peso: texto(f, 'peso') || null,
  };
}

export async function acaoSalvarAtividade(f: FormData) {
  const id = texto(f, 'id');
  const item = texto(f, 'atividade');
  const volta = fichaDe(id, '/atividades');
  if (item) {
    await executar(() => volta, volta, 'Atividade alterada.', ({ usuario, app }) => alterarAtividade(app.planilhas, usuario.autorizador, id, item, Number(texto(f, 'versao_atividade')), lerAtividade(f)));
    return;
  }
  await executar(() => volta, volta, 'Atividade incluída.', ({ usuario, app }) => adicionarAtividade(app.planilhas, usuario.autorizador, id, lerAtividade(f)));
}

export async function acaoMudarSituacaoAtividade(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/atividades');
  const situacao = lista<SituacaoAtividade>(SITUACOES_ATIVIDADE, texto(f, 'situacao'));
  await executar(() => volta, volta, 'Situação da atividade atualizada.', ({ usuario, app }) =>
    mudarSituacaoAtividade(app.planilhas, usuario.autorizador, id, texto(f, 'atividade'), Number(texto(f, 'versao_atividade')), { situacao, inicioReal: texto(f, 'inicio_real') || null, fimReal: texto(f, 'fim_real') || null }),
  );
}

export async function acaoRetirarAtividade(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/atividades');
  await executar(() => volta, volta, 'Atividade retirada. Ela continua guardada.', ({ usuario, app }) => retirarAtividade(app.planilhas, usuario.autorizador, id, texto(f, 'atividade'), Number(texto(f, 'versao_atividade'))));
}

function lerLinha(f: FormData) {
  return { categoria: texto(f, 'categoria'), descricao: texto(f, 'descricao'), valor: texto(f, 'valor'), fonte: texto(f, 'fonte') || null };
}

export async function acaoSalvarLinhaOrcamento(f: FormData) {
  const id = texto(f, 'id');
  const item = texto(f, 'linha');
  const volta = fichaDe(id, '/orcamento');
  if (item) {
    await executar(() => volta, volta, 'Linha alterada.', ({ usuario, app }) => alterarLinhaOrcamento(app.planilhas, usuario.autorizador, id, item, Number(texto(f, 'versao_linha')), lerLinha(f)));
    return;
  }
  await executar(() => volta, volta, 'Linha incluída.', ({ usuario, app }) => adicionarLinhaOrcamento(app.planilhas, usuario.autorizador, id, lerLinha(f)));
}

export async function acaoRetirarLinhaOrcamento(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/orcamento');
  await executar(() => volta, volta, 'Linha retirada. Ela continua guardada.', ({ usuario, app }) => retirarLinhaOrcamento(app.planilhas, usuario.autorizador, id, texto(f, 'linha'), Number(texto(f, 'versao_linha'))));
}

// ---------- Fase 4: problemas, mudanças e relatórios (P4) ----------

export async function acaoRegistrarProblema(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/riscos');
  await executar(() => volta, volta, 'Problema registrado.', ({ usuario, app }) =>
    registrarProblema(app.planilhas, usuario.autorizador, id, { descricao: texto(f, 'descricao'), gravidade: lista<Grau>(GRAUS, texto(f, 'gravidade')), dono: texto(f, 'dono') || null }),
  );
}

export async function acaoResolverProblema(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/riscos');
  await executar(() => volta, volta, 'Problema resolvido.', ({ usuario, app }) =>
    resolverProblema(app.planilhas, usuario.autorizador, id, texto(f, 'problema'), Number(texto(f, 'versao_problema')), texto(f, 'solucao'), texto(f, 'data')),
  );
}

/** Só volta para páginas do próprio projeto (a página guarda o que a pessoa digitou no endereço). */
const voltaDoPedido = (f: FormData, id: string) => {
  const v = texto(f, 'volta');
  return v.startsWith(`/projetos/${id}/mudancas`) ? v : fichaDe(id, '/mudancas/novo');
};

export async function acaoPedirMudanca(f: FormData) {
  const id = texto(f, 'id');
  const tipo = lista<TipoMudanca>(TIPOS_MUDANCA, texto(f, 'tipo'));
  const lista_ = fichaDe(id, '/mudancas');
  await executar(
    () => lista_,
    voltaDoPedido(f, id),
    (r) => ((r as { situacao: string }).situacao === 'aplicada' ? { chave: 'ok', mensagem: 'Mudança aplicada. Ela ficou dentro da tolerância e está no histórico.' } : { chave: 'ok', mensagem: 'Pedido enviado. Nada muda até a decisão.' }),
    ({ usuario, app }) =>
      pedirMudanca(app.planilhas, usuario.autorizador, id, { tipo, alvo: texto(f, 'alvo') || null, proposto: texto(f, 'proposto'), justificativa: texto(f, 'justificativa'), cabeNoEscopoLivre: texto(f, 'escopo_livre') === 'sim' }),
  );
}

export async function acaoDecidirMudanca(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/mudancas');
  const aprovar = texto(f, 'decisao') === 'aprovar';
  await executar(() => volta, volta, aprovar ? 'Decisão registrada: pedido aprovado.' : 'Decisão registrada: pedido recusado.', ({ usuario, app }) =>
    decidirMudanca(app.planilhas, usuario.autorizador, texto(f, 'pedido'), Number(texto(f, 'versao_pedido')), aprovar ? 'aprovar' : 'recusar', texto(f, 'justificativa')),
  );
}

export async function acaoEnviarRelatorio(f: FormData) {
  const id = texto(f, 'id');
  const volta = fichaDe(id, '/relatorios');
  const situacao = texto(f, 'situacao');
  await executar(() => volta, volta, 'Relatório enviado.', ({ usuario, app }) =>
    enviarRelatorio(
      app.planilhas,
      usuario.autorizador,
      id,
      {
        periodoInicio: texto(f, 'inicio'),
        periodoFim: texto(f, 'fim'),
        texto: texto(f, 'texto'),
        gasto: texto(f, 'gasto') || null,
        situacao: (SITUACOES_RELATORIO as readonly string[]).includes(situacao) ? (situacao as SituacaoRelatorio) : null,
        justificativa: texto(f, 'justificativa') || null,
      },
      numerosDePessoas(app.planilhas),
    ),
  );
}

// ---------- Encerramento e lições (P5) ----------

const ENC = '/encerramento';

export async function acaoIniciarEncerramento(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => fichaDe(id, ENC), fichaDe(id, ENC), 'Encerramento iniciado. Complete o check-list, o relatório final e uma lição.', ({ usuario, app }) =>
    iniciarEncerramento(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))),
  );
}

export async function acaoMarcarChecklist(f: FormData) {
  const id = texto(f, 'id');
  const item = texto(f, 'item');
  const feito = texto(f, 'feito') === 'sim';
  await executar(() => fichaDe(id, ENC), fichaDe(id, ENC), 'Salvo.', ({ usuario, app }) => {
    if (!(ITENS_CHECKLIST as readonly string[]).includes(item)) throw new ErroProjetos('Item do check-list desconhecido.');
    return marcarChecklist(app.planilhas, usuario.autorizador, id, item as ItemChecklist, feito, texto(f, 'observacao') || null);
  });
}

export async function acaoSalvarTextoEncerramento(f: FormData) {
  const id = texto(f, 'id');
  const item = texto(f, 'item');
  await executar(() => fichaDe(id, ENC), fichaDe(id, ENC), 'Salvo.', ({ usuario, app }) => {
    if (!(ITENS_TEXTO as readonly string[]).includes(item)) throw new ErroProjetos('Texto de encerramento desconhecido.');
    return salvarTextoDeEncerramento(app.planilhas, usuario.autorizador, id, item as ItemTexto, texto(f, 'texto'));
  });
}

export async function acaoRegistrarLicao(f: FormData) {
  const id = texto(f, 'id');
  const categoria = texto(f, 'categoria');
  await executar(() => fichaDe(id, ENC), fichaDe(id, ENC), 'Lição registrada.', ({ usuario, app }) =>
    registrarLicao(app.planilhas, usuario.autorizador, id, {
      categoria: (CATEGORIAS_LICAO as readonly string[]).includes(categoria) ? (categoria as CategoriaLicao) : ('' as CategoriaLicao),
      oQueAconteceu: texto(f, 'aconteceu'),
      fazerDiferente: texto(f, 'diferente'),
    }),
  );
}

export async function acaoAbrirPortaEncerramento(f: FormData) {
  const id = texto(f, 'id');
  await executar(() => fichaDe(id), fichaDe(id, ENC), 'Porta de encerramento aberta. A Diretoria decide.', ({ usuario, app }) =>
    abrirPortaDeEncerramento(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), numerosDePessoas(app.planilhas), { resultado: leitorDeResultado(app.planilhas) }),
  );
}
