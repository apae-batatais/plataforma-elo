'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { salvarConfig } from '@/modulos/projetos/aplicacao/configuracoes';
import { assumirIdeia, cadastrarIdeia, cancelarProjeto, editarIdeia, enviarParaAssumir, retomarProjeto, trocarResponsavel, type DadosIdeia } from '@/modulos/projetos/aplicacao/ideias';
import { abrirPorta, darParecer, decidirPorta } from '@/modulos/projetos/aplicacao/portas';
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
  await executar(() => ficha(id), ficha(id), 'Porta 1 aberta. Agora esperam os pareceres.', ({ usuario, app }) => abrirPorta(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao'))));
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
        },
        { versoes },
      );
    },
  );
}
