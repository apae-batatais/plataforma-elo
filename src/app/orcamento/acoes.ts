'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import {
  encerrarPosto, ErroValidacaoFolha, salvarCargo, salvarCentroCusto, salvarParametros, salvarPosto, salvarRateios, salvarValorTabela,
} from '@/modulos/orcamento/aplicacao/folha';
import { analisarImportacao, importarFolha, lerXlsx, type Analise } from '@/modulos/orcamento/aplicacao/importacao';
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
  nivel: z.string().nullable(),
  cargaHoraria: z.number().nullable(),
  inicio: z.string(),
  observacao: z.string().nullable(),
  componentes: z.object(Object.fromEntries(COMPONENTES.map((c) => [c.chave, z.number()]))),
  rateio: z.array(z.object({ centro: z.string(), percentual: z.number() })),
  vigencia: z.string(),
});

export async function acaoSalvarPosto(_: EstadoAcao, f: FormData): Promise<EstadoAcao> {
  const { usuario, app } = await contexto();
  let id: string;
  try {
    const dados = esquemaPosto.parse(JSON.parse(texto(f, 'dados')));
    id = await salvarPosto(app.planilhas, usuario.autorizador, { ...dados, vigencia: inicioDoMes(dados.vigencia) } as never);
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof z.ZodError || erro instanceof SyntaxError) return { erro: 'Confira os campos: há valor em formato inválido.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/postos/${id}?ok=${encodeURIComponent('Posto salvo.')}`);
}

export async function acaoEncerrarPosto(f: FormData) {
  const id = texto(f, 'id');
  await executar(`/orcamento/postos/${id}`, 'Desligamento registrado.', ({ usuario, app }) =>
    encerrarPosto(app.planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), texto(f, 'desligamento')),
  );
}

// ---------------------------------------------------------------------------
// Rateio geral
// ---------------------------------------------------------------------------

const esquemaRateios = z.array(z.object({ postoId: z.string(), rateio: z.array(z.object({ centro: z.string(), percentual: z.number() })) }));

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
  redirect(`/orcamento/rateio?ok=${encodeURIComponent(n === 0 ? 'Nada mudou.' : `Rateio salvo em ${n} ${n === 1 ? 'posto' : 'postos'}.`)}`);
}

// ---------------------------------------------------------------------------
// Cadastros e parâmetros
// ---------------------------------------------------------------------------

export async function acaoSalvarCentro(f: FormData) {
  await executar('/orcamento/cadastros', 'Centro de custo cadastrado.', ({ usuario, app }) =>
    salvarCentroCusto(app.planilhas, usuario.autorizador, { codigo: texto(f, 'codigo'), nome: texto(f, 'nome'), area: texto(f, 'area') || null }),
  );
}

export async function acaoSalvarCargo(f: FormData) {
  await executar('/orcamento/cadastros', 'Cargo cadastrado.', ({ usuario, app }) =>
    salvarCargo(app.planilhas, usuario.autorizador, {
      codigo: texto(f, 'codigo'),
      nome: texto(f, 'nome'),
      grupo: texto(f, 'grupo') || null,
      cargaReferencia: numeroOuNulo(f, 'carga'),
    }),
  );
}

export async function acaoSalvarValorTabela(f: FormData) {
  await executar('/orcamento/cadastros', 'Valor da tabela salarial gravado.', ({ usuario, app }) =>
    salvarValorTabela(app.planilhas, usuario.autorizador, {
      cargo: texto(f, 'cargo'),
      nivel: texto(f, 'nivel'),
      valor: numeroOuNulo(f, 'valor') ?? NaN,
      vigencia: inicioDoMes(texto(f, 'vigencia')),
    }),
  );
}

export async function acaoSalvarParametros(f: FormData) {
  await executar('/orcamento/parametros', 'Parâmetros salvos.', ({ usuario, app }) =>
    salvarParametros(
      app.planilhas,
      usuario.autorizador,
      parametrosCom(Object.fromEntries(PARAMETROS.map((p) => [p.chave, numeroOuNulo(f, p.chave) ?? NaN]))),
    ),
  );
}

// ---------------------------------------------------------------------------
// Importação da planilha da folha
// ---------------------------------------------------------------------------

export interface EstadoImportacao {
  erro?: string;
  analise?: Analise;
}

export async function acaoAnalisarImportacao(_: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  const { usuario, app } = await contexto();
  const arquivo = f.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: 'Escolha o arquivo .xlsx da folha.' };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: 'O arquivo passa de 5 MB. Apague abas que não são da folha e tente de novo.' };
  try {
    return { analise: await analisarImportacao(app.planilhas, usuario.autorizador, await lerXlsx(await arquivo.arrayBuffer())) };
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    throw erro;
  }
}

export async function acaoConfirmarImportacao(_: EstadoImportacao, f: FormData): Promise<EstadoImportacao> {
  const { usuario, app } = await contexto();
  let n: number;
  try {
    n = (await importarFolha(app.planilhas, usuario.autorizador, JSON.parse(texto(f, 'proposta')))).postos;
  } catch (erro) {
    if (conhecido(erro)) return { erro: (erro as Error).message };
    if (erro instanceof SyntaxError) return { erro: 'A importação veio incompleta. Envie o arquivo de novo.' };
    throw erro;
  }
  revalidatePath('/orcamento', 'layout');
  redirect(`/orcamento/postos?ok=${encodeURIComponent(`${n} postos importados.`)}`);
}
