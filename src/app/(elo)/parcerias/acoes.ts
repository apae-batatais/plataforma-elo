'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import {
  adicionarFonte,
  cancelarAporte,
  criarTermo,
  definirFonteDaMeta,
  definirLimiteOcupacao,
  encerrarTermo,
  ErroTermo,
  registrarAporte,
  type DadosFonte,
} from '@/modulos/parcerias/aplicacao/parcerias';
import { FONTES_NUMERO, TIPOS_APORTE, TIPOS_INSTRUMENTO, type FonteNumero, type TipoInstrumento } from '@/modulos/parcerias/dominio/termos';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const texto = (f: FormData, c: string) => String(f.get(c) ?? '').trim();
const numero = (f: FormData, c: string) => {
  const t = texto(f, c).replace(/\./g, '').replace(',', '.');
  return t ? Number(t) : null;
};
const meses = (f: FormData, c: string) => texto(f, c).split(/[\s,;]+/).filter(Boolean);
const conhecido = (e: unknown) => e instanceof ErroTermo || e instanceof ErroConflito || e instanceof ErroPermissao;

async function executar(pagina: string, sucesso: string, acao: (ctx: { email: string; usuario: NonNullable<Awaited<ReturnType<typeof usuarioLogado>>>; planilhas: Awaited<ReturnType<typeof obterAplicacao>>['planilhas'] }) => Promise<string | void>) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { planilhas } = await obterAplicacao();
  let destino: string;
  try {
    const novo = await acao({ email: usuario.email, usuario, planilhas });
    destino = `${novo ?? pagina}${(novo ?? pagina).includes('?') ? '&' : '?'}ok=${encodeURIComponent(sucesso)}`;
  } catch (e) {
    if (!conhecido(e)) throw e;
    destino = `${pagina}?erro=${encodeURIComponent((e as Error).message)}`;
  }
  revalidatePath('/parcerias', 'layout');
  redirect(destino);
}

function fonteDoForm(f: FormData): DadosFonte {
  const forma = texto(f, 'forma') === 'per_capita' ? 'per_capita' : 'global';
  const cronograma = texto(f, 'cronograma') === 'digitado' ? 'digitado' : 'iguais';
  const parcelas = texto(f, 'parcelas')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [mes, valor] = l.split(/[\s;]+/);
      return { mes, valor: Number((valor ?? '').replace(/\./g, '').replace(',', '.')) };
    });
  const categorias = texto(f, 'categorias')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.lastIndexOf(' ');
      return { categoria: l.slice(0, i).trim(), valor: Number(l.slice(i + 1).replace(/\./g, '').replace(',', '.')) };
    });
  return {
    nome: texto(f, 'fonte_nome'),
    forma,
    valorInicial: numero(f, 'valor_inicial'),
    perCapita: numero(f, 'per_capita'),
    periodicidade: texto(f, 'periodicidade') === 'anual' ? 'anual' : texto(f, 'periodicidade') === 'mensal' ? 'mensal' : null,
    cronograma,
    meses: meses(f, 'meses'),
    parcelas,
    recursosProprios: numero(f, 'recursos_proprios_fonte'),
    permiteRemanejar: f.get('permite_remanejar') === 'sim',
    categorias,
  };
}

export async function acaoCriarTermo(f: FormData) {
  await executar('/parcerias/novo', 'Termo cadastrado.', async ({ usuario, planilhas }) => {
    const tipo = texto(f, 'tipo') as TipoInstrumento;
    const id = await criarTermo(planilhas, usuario.autorizador, {
      parceiro: texto(f, 'parceiro'),
      numero: texto(f, 'numero'),
      objeto: texto(f, 'objeto') || null,
      tipo: TIPOS_INSTRUMENTO.includes(tipo) ? tipo : 'outro',
      tipoDescricao: texto(f, 'tipo_descricao') || null,
      inicio: texto(f, 'inicio'),
      fim: texto(f, 'fim'),
      unidadeMeta: texto(f, 'unidade_meta'),
      recursosProprios: numero(f, 'recursos_proprios'),
      servicos: [{ servico: texto(f, 'servico'), vagasOferecidas: numero(f, 'vagas_oferecidas'), vagasCusteadas: numero(f, 'vagas_custeadas') }],
      fontes: [fonteDoForm(f)],
    });
    return `/parcerias/${id}`;
  });
}

export async function acaoAdicionarFonte(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Fonte adicionada.', async ({ usuario, planilhas }) => {
    await adicionarFonte(planilhas, usuario.autorizador, id, fonteDoForm(f));
  });
}

export async function acaoRegistrarAporte(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Aporte registrado.', async ({ usuario, planilhas }) => {
    const tipo = texto(f, 'tipo') as (typeof TIPOS_APORTE)[number];
    const parcelas = texto(f, 'parcelas')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const [mes, valor] = l.split(/[\s;]+/);
        return { mes, valor: Number((valor ?? '').replace(/\./g, '').replace(',', '.')) };
      });
    await registrarAporte(planilhas, usuario.autorizador, id, {
      fonteId: texto(f, 'fonte_id'),
      tipo: TIPOS_APORTE.includes(tipo) ? tipo : 'outro',
      registradoEm: texto(f, 'registrado_em'),
      inicio: texto(f, 'inicio'),
      fim: texto(f, 'fim'),
      valor: numero(f, 'valor') ?? 0,
      cronograma: texto(f, 'cronograma') === 'digitado' ? 'digitado' : 'iguais',
      meses: meses(f, 'meses'),
      parcelas,
      categoria: texto(f, 'categoria') || null,
      descricao: texto(f, 'descricao') || null,
    });
  });
}

export async function acaoCancelarAporte(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Aporte cancelado.', async ({ usuario, planilhas }) => {
    await cancelarAporte(planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')));
  });
}

export async function acaoEncerrarTermo(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Termo encerrado.', async ({ usuario, planilhas }) => {
    await encerrarTermo(planilhas, usuario.autorizador, id, Number(texto(f, 'versao')));
  });
}

export async function acaoLimiteOcupacao(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Limite de ocupação salvo.', async ({ usuario, planilhas }) => {
    await definirLimiteOcupacao(planilhas, usuario.autorizador, id, Number(texto(f, 'versao')), numero(f, 'limite') ?? 0);
  });
}

export async function acaoFonteDaMeta(f: FormData) {
  const id = texto(f, 'termo_id');
  await executar(`/parcerias/${id}`, 'Fonte do número da meta salva.', async ({ usuario, planilhas }) => {
    const fonte = texto(f, 'fonte') as FonteNumero;
    await definirFonteDaMeta(planilhas, usuario.autorizador, texto(f, 'meta_id'), Number(texto(f, 'versao')), {
      fonte: FONTES_NUMERO.includes(fonte) ? fonte : 'manual',
      servico: texto(f, 'servico') || null,
    });
  });
}
