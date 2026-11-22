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
  registrarRisco,
  retirarItemMarco,
  salvarDocumento,
} from '@/modulos/projetos/aplicacao/fases';
import { definirFonteDoItem, registrarMedicao } from '@/modulos/projetos/aplicacao/indicadores';
import { FONTES_NUMERO, type FonteNumero } from '@/modulos/projetos/dominio/indicadores';
import { abrirPorta, darParecer, decidirPorta } from '@/modulos/projetos/aplicacao/portas';
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
async function executar(pagina: (resultado: unknown) => string, erroEm: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  try {
    destino = comMensagem(pagina(await acao(ctx)), 'ok', sucesso);
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
      await editarIdeia(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), dados);
      if (texto(f, 'enviar') === 'sim') await enviarParaAssumir(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')) + 1);
    });
    return;
  }
  const enviar = texto(f, 'enviar') === 'sim';
  await executar(
    (r) => ficha((r as { id: string }).id),
    '/projetos/nova',
    enviar ? 'Ideia enviada. Uma coordenação vai assumir como responsável.' : 'Rascunho salvo.',
    ({ usuario, app }) => cadastrarIdeia(app.planilhas, usuario.autorizador, dados, { enviar }),
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
  await executar(() => ficha(id), ficha(id), 'Projeto cancelado. Ele continua guardado.', ({ usuario, app }) => cancelarProjeto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'motivo')));
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
    'Decisão registrada.',
    ({ usuario, app }) => decidirPorta(app.planilhas, usuario.autorizador, texto(f, 'porta'), Number(texto(f, 'versao_porta')), (DECISOES as readonly string[]).includes(decisao) ? (decisao as Decisao) : ('' as Decisao), texto(f, 'justificativa')),
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
