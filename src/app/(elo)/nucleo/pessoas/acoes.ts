'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroValidacao } from '@/nucleo/acesso/gestao';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { PAPEIS } from '@/nucleo/estrutura/tabelas';
import {
  cadastrarPessoa,
  corrigirPessoa,
  encerrarVinculo,
  ErroDuplicidade,
  vincularPessoa,
  type DadosDaPessoa,
} from '@/nucleo/pessoas/gravacao';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const PAGINA = '/nucleo/pessoas';
const MSG_CONFLITO = 'Os dados mudaram enquanto você editava. Reabra e tente de novo.';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

function mensagemDe(erro: unknown): string | null {
  if (erro instanceof ErroConflito) return MSG_CONFLITO;
  if (erro instanceof ErroValidacao || erro instanceof ErroPermissao) return erro.message;
  return null;
}

function dadosDaPessoa(f: FormData): DadosDaPessoa {
  return {
    nome: texto(f, 'nome'),
    nomeSocial: texto(f, 'nomeSocial'),
    dataNascimento: texto(f, 'dataNascimento'),
    cpf: texto(f, 'cpf'),
    nis: texto(f, 'nis'),
    email: texto(f, 'email'),
    telefone: texto(f, 'telefone'),
    cidade: texto(f, 'cidade'),
    bairro: texto(f, 'bairro'),
  };
}

export interface EstadoCadastro {
  erro?: string;
  duplicidade?: { tipo: 'cpf' | 'nome'; existenteId: string | null };
  valores?: Record<string, string>;
}

/** O formulário de cadastro fica aberto com o que foi digitado quando há erro; só sucesso volta à lista. */
export async function acaoCadastrarPessoa(_: EstadoCadastro, f: FormData): Promise<EstadoCadastro> {
  const { usuario, app } = await contexto();
  const valores = Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const papel = texto(f, 'papel');
  let destino: string;
  try {
    const r = await cadastrarPessoa(app.planilhas, usuario.autorizador, {
      ...dadosDaPessoa(f),
      papel: (PAPEIS as readonly string[]).includes(papel) ? (papel as (typeof PAPEIS)[number]) : undefined,
      servico: texto(f, 'servico'),
      entrada: texto(f, 'entrada'),
      confirmarOutraPessoa: texto(f, 'confirmarOutraPessoa') === '1',
    });
    destino = r.falhaNoVinculo
      ? `${PAGINA}?abrir=${r.pessoa.id}&erro=${encodeURIComponent('A pessoa foi cadastrada, mas o vínculo com o serviço não foi gravado. Vincule-a abaixo.')}`
      : `${PAGINA}?ok=${encodeURIComponent(r.vinculo ? 'Pessoa cadastrada e vinculada ao serviço.' : 'Pessoa cadastrada.')}`;
  } catch (erro) {
    if (erro instanceof ErroDuplicidade) return { erro: erro.message, duplicidade: { tipo: erro.tipo, existenteId: erro.existenteId }, valores };
    const msg = mensagemDe(erro);
    if (!msg) throw erro;
    return { erro: msg, valores };
  }
  redirect(destino);
}

async function executar(pessoaId: string, sucesso: string, acao: (c: Awaited<ReturnType<typeof contexto>>) => Promise<void>) {
  const c = await contexto();
  let destino: string;
  try {
    await acao(c);
    destino = `${PAGINA}?ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    const msg = mensagemDe(erro);
    if (!msg) throw erro;
    destino = `${PAGINA}?abrir=${encodeURIComponent(pessoaId)}&erro=${encodeURIComponent(msg)}`;
  }
  redirect(destino);
}

export async function acaoCorrigirPessoa(f: FormData) {
  await executar(texto(f, 'id'), 'Dados corrigidos.', ({ usuario, app }) =>
    corrigirPessoa(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), dadosDaPessoa(f)).then(() => undefined),
  );
}

export async function acaoVincularPessoa(f: FormData) {
  await executar(texto(f, 'pessoaId'), 'Vínculo criado.', ({ usuario, app }) =>
    vincularPessoa(app.planilhas, usuario.autorizador, { pessoaId: texto(f, 'pessoaId'), servico: texto(f, 'servico'), entrada: texto(f, 'entrada') }).then(() => undefined),
  );
}

export async function acaoEncerrarVinculo(f: FormData) {
  await executar(texto(f, 'pessoaId'), 'Vínculo encerrado.', ({ usuario, app }) =>
    encerrarVinculo(app.planilhas, usuario.autorizador, {
      vinculoId: texto(f, 'vinculoId'),
      versao: Number(texto(f, 'versao')),
      saida: texto(f, 'saida'),
      motivo: texto(f, 'motivo'),
    }).then(() => undefined),
  );
}
