'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { encerrarPosto, ErroValidacaoFolha, salvarParametros, salvarPosto, salvarRateios } from '@/modulos/orcamento/aplicacao/folha';
import { analisarImportacao, descreverArquivo, importarFolha, lerMapeamento, lerXlsx, type Analise } from '@/modulos/orcamento/aplicacao/importacao';
import type { AbaResumida, Mapeamento } from '@/modulos/orcamento/dominio/importacao';
import { COMPONENTES, PARAMETROS, parametrosCom } from '@/modulos/orcamento/dominio/folha';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

export interface EstadoAcao {
  erro?: string;
}

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroValidacaoFolha || e instanceof ErroConflito || e instanceof ErroPermissao;

/** Formulários simples: volta para a página com mensagem no endereço. */
async function executar(pagina: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  try {
    await acao(ctx);
    destino = `${pagina}?ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `${pagina}?erro=${encodeURIComponent((erro as Error).message)}`;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(destino);
}

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const numeroOuNulo = (f: FormData, campo: string) => {
  const t = texto(f, campo).replace(',', '.');
  return t === '' ? null : Number(t);
};
/** "2027-03" (campo de mês) → "2027-03-01". */
const inicioDoMes = (t: string) => (/^\d{4}-\d{2}$/.test(t) ? `${t}-01` : t);

// ---------------------------------------------------------------------------
// Posto (formulário com grid de rateio)
// ---------------------------------------------------------------------------

const esquemaPosto = z.object({
  id: z.string().optional(),
  versao: z.number().optional(),
  ficha: z.string().nullable(),
  colaborador: z.string().nullable(),
  cargo: z.string(),
  departamento: z.string().nullable(),
  cargaHoraria: z.number().nullable(),
  inicio: z.string(),
  observacao: z.string().nullable(),
  componentes: z.object({
    ...Object.fromEntries(COMPONENTES.map((c) => [c.chave, z.number()])),
    reajuste: z.number(),
    hora_atividade: z.boolean(),
  }),
  rateio: z.array(z.object({ centro: z.string(), percentual: z.number() })),
  vigencia: z.string(),
});

export async function acaoSalvarPosto(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  const { usuario, app } = await contexto();
  let id: string;
  try {
    const dados = esquemaPosto.parse(JSON.parse(texto(f, 'dados')));
    id = await salvarPosto(app.planilhas, usuario.autorizador, {
      ...dados,
      vigencia: inicioDoMes(dados.vigencia),
    } as never);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof z.ZodError || erro instanceof SyntaxError) return { erro: 'Confira os campos: há valor em formato inválido.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/folha/${id}?ok=${encodeURIComponent('Funcionário salvo.')}`);
}

export async function acaoEncerrarPosto(f: FormData) {
  const id = texto(f, 'id');
  await executar(`/orcamento/folha/${id}`, 'Desligamento registrado.', ({ usuario, app }) =>
    encerrarPosto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'desligamento')),
  );
}

// ---------------------------------------------------------------------------
// Rateio geral
// ---------------------------------------------------------------------------

const esquemaRateios = z.array(
  z.object({
    postoId: z.string(),
    rateio: z.array(z.object({ centro: z.string(), percentual: z.number() })),
  }),
);

export async function acaoSalvarRateios(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  const { usuario, app } = await contexto();
  let n: number;
  try {
    n = await salvarRateios(app.planilhas, usuario.autorizador, esquemaRateios.parse(JSON.parse(texto(f, 'dados'))), inicioDoMes(texto(f, 'vigencia')));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof z.ZodError || erro instanceof SyntaxError) return { erro: 'Há percentual em formato inválido.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/lotacao?ok=${encodeURIComponent(n === 0 ? 'Nada mudou.' : `Lotação salva para ${n} ${n === 1 ? 'funcionário' : 'funcionários'}.`)}`);
}

// ---------------------------------------------------------------------------
// Cadastros e parâmetros
// ---------------------------------------------------------------------------

export async function acaoSalvarParametros(f: FormData) {
  await executar('/orcamento/parametros', 'Parâmetros salvos.', ({ usuario, app }) =>
    salvarParametros(app.planilhas, usuario.autorizador, parametrosCom(Object.fromEntries(PARAMETROS.map((p) => [p.chave, numeroOuNulo(f, p.chave) ?? NaN])))),
  );
}

// ---------------------------------------------------------------------------
// Importação da planilha da folha
// ---------------------------------------------------------------------------

export interface EstadoImportacao {
  erro?: string;
  analise?: Analise;
}

export interface EstadoArquivo {
  erro?: string;
  abas?: AbaResumida[];
  sugestao?: Mapeamento | null;
}

async function abasDoArquivo(f: FormData) {
  const arquivo = f.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) throw new ErroValidacaoFolha('Escolha o arquivo .xlsx da folha.');
  if (arquivo.size > 5 * 1024 * 1024) throw new ErroValidacaoFolha('O arquivo passa de 5 MB. Apague abas que não são da folha e tente de novo.');
  return lerXlsx(await arquivo.arrayBuffer());
}

/** Passo 1: lê as abas do arquivo e sugere o DE-PARA. */
export async function acaoLerArquivo(_: EstadoArquivo, f: FormData): Promise<EstadoArquivo> {
  const { usuario } = await contexto();
  try {
    return descreverArquivo(usuario.autorizador, await abasDoArquivo(f));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}

/** Passo 2: lê o arquivo pelo DE-PARA escolhido e mostra o que será importado. */
export async function acaoAnalisarImportacao(_: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  const { usuario, app } = await contexto();
  try {
    const mapeamento = lerMapeamento(JSON.parse(texto(f, 'mapeamento') || 'null'));
    return {
      analise: await analisarImportacao(app.planilhas, usuario.autorizador, await abasDoArquivo(f), mapeamento),
    };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError)
      return {
        erro: 'O DE-PARA das colunas veio incompleto. Confira as escolhas e tente de novo.',
      };
    throw erro;
  }
}

export async function acaoConfirmarImportacao(_: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  const { usuario, app } = await contexto();
  let n: { postos: number; lotacoes: number };
  try {
    n = await importarFolha(app.planilhas, usuario.autorizador, JSON.parse(texto(f, 'proposta')));
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A importação veio incompleta. Envie o arquivo de novo.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  const partes = [
    n.postos ? `${n.postos} ${n.postos === 1 ? 'funcionário ou vaga importado' : 'funcionários e vagas importados'}` : '',
    n.lotacoes ? `${n.lotacoes} ${n.lotacoes === 1 ? 'lotação gravada' : 'lotações gravadas'}` : '',
  ].filter(Boolean);
  redirect(`/orcamento/folha?ok=${encodeURIComponent(partes.length ? `${partes.join(' e ')}.` : 'Nada mudou: as lotações já estavam iguais.')}`);
}
