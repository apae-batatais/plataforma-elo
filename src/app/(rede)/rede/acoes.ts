'use server';

import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { conferirLoginGoogle, ErroLogin } from '@/nucleo/sessao/google';
import {
  autorizadorDaRede,
  ErroRede,
  incluirAdministradorRede,
  mudarSituacao,
  painelDaRede,
  retirarAdministradorRede,
  salvarInstituicao,
} from '@/nucleo/rede/rede';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { configGeral } from '@/plataforma/instituicao';
import { esquecerInstituicoes } from '@/plataforma/rede';
import { administradorDaRedeLogado, aplicacaoDaRedeAtual, encerrarSessaoRede, iniciarSessaoRede } from '@/plataforma/sessao-rede';
import { prepararInstituicao, resumoDaPreparacao } from './preparar-instituicao';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const linhas = (t: string) =>
  t
    .split(/[\n,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
const conhecido = (e: unknown) => e instanceof ErroRede || e instanceof ErroConflito || e instanceof ErroPermissao;

async function adm() {
  const a = await administradorDaRedeLogado();
  if (!a) redirect('/rede/entrar');
  return a;
}

async function executar(pagina: string, sucesso: string, acao: (a: Awaited<ReturnType<typeof adm>>) => Promise<unknown>, mensagem?: () => string) {
  const a = await adm();
  let destino: string;
  try {
    await acao(a);
    esquecerInstituicoes();
    destino = `${pagina}${pagina.includes('?') ? '&' : '?'}ok=${encodeURIComponent(mensagem?.() || sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `${pagina}${pagina.includes('?') ? '&' : '?'}erro=${encodeURIComponent((erro as Error).message)}`;
  }
  redirect(destino);
}

/** Cadastrar ou alterar uma instituição (formulário com retorno de erro, sem perder o que foi digitado). */
export async function acaoSalvarInstituicao(
  _: { erro?: string; valores?: Record<string, string> },
  f: FormData,
): Promise<{ erro?: string; valores?: Record<string, string> }> {
  const a = await adm();
  const id = texto(f, 'id');
  let salvaId: string;
  try {
    salvaId = await salvarInstituicao(
      a.app.planilhas,
      a.autorizador,
      {
        codigo: texto(f, 'codigo'),
        nome: texto(f, 'nome'),
        nomeCompleto: texto(f, 'nomeCompleto'),
        dominio: texto(f, 'dominio').replace(/^@/, ''),
        enderecos: linhas(texto(f, 'enderecos')).map((e) => e.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')),
        pasta: texto(f, 'pasta'),
        administradoresIniciais: linhas(texto(f, 'administradoresIniciais')),
        unidades: texto(f, 'unidades')
          .split('\n')
          .map((l) => l.trim())
          .filter(Boolean)
          .map((l) => {
            const [codigo, ...nome] = l.split('=');
            return {
              codigo: codigo.trim().toLowerCase(),
              nome: nome.join('=').trim(),
            };
          }),
      },
      id ? { id, versao: Number(texto(f, 'versao')) } : undefined,
    );
  } catch (erro) {
    // Devolve o que foi digitado, para o formulário não perder nada.
    if (conhecido(erro))
      return {
        erro: (erro as Error).message,
        valores: Object.fromEntries([...f.entries()].map(([k, v]) => [k, String(v)])),
      };
    throw erro;
  }
  esquecerInstituicoes();
  const salva = id ? 'Instituição atualizada.' : 'Instituição cadastrada, em preparação.';

  // Com a pasta no cadastro, o Elo confere e prepara sozinho, sem outro clique (ADR-018).
  const instituicao = (await painelDaRede(a.app.planilhas, a.autorizador)).instituicoes.find((x) => x.id === salvaId);
  const pastaMudou = instituicao?.pasta && (!id || instituicao.pasta !== texto(f, 'pasta_anterior') || !instituicao.planilhas.nucleo);
  if (!instituicao || !pastaMudou) redirect(`/rede?ok=${encodeURIComponent(salva)}`);
  let destino: string;
  try {
    const r = await prepararInstituicao(a, instituicao);
    esquecerInstituicoes();
    destino = `/rede?conferir=${encodeURIComponent(instituicao.id)}&ok=${encodeURIComponent(`${salva} ${resumoDaPreparacao(r)}`)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    esquecerInstituicoes();
    destino = `/rede?conferir=${encodeURIComponent(instituicao.id)}&erro=${encodeURIComponent(`${salva} A estrutura não foi preparada: ${(erro as Error).message}`)}`;
  }
  redirect(destino);
}

export async function acaoMudarSituacao(f: FormData) {
  const situacao = texto(f, 'situacao') as 'ativa' | 'suspensa' | 'preparacao';
  const mensagem = {
    ativa: 'Instituição ativa: a equipe já pode entrar.',
    suspensa: 'Instituição suspensa: ninguém entra até reativar.',
    preparacao: 'Instituição em preparação.',
  }[situacao];
  await executar('/rede', mensagem ?? 'Situação alterada.', (a) =>
    mudarSituacao(a.app.planilhas, a.autorizador, texto(f, 'id'), Number(texto(f, 'versao')), situacao),
  );
}

export async function acaoIncluirAdministrador(f: FormData) {
  await executar('/rede/administradores', 'Administrador incluído.', (a) =>
    incluirAdministradorRede(a.app.planilhas, a.autorizador, a.app.rede.dominio, { email: texto(f, 'email'), nome: texto(f, 'nome') }),
  );
}

export async function acaoRetirarAdministrador(f: FormData) {
  await executar('/rede/administradores', 'Administrador retirado.', (a) =>
    retirarAdministradorRede(a.app.planilhas, a.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

/** Demonstração: entra como a administração fictícia da rede. */
export async function acaoEntrarRedeDemonstracao() {
  if (configGeral().modo !== 'demonstracao') throw new Error('Entrada fictícia só existe na demonstração.');
  await iniciarSessaoRede('rede@exemplo.local', 'Administração da rede (fictícia)');
  redirect('/rede');
}

/** Produção: login Google com e-mail da Operadora que administra a rede. */
export async function acaoEntrarRedeComGoogle(credencial: string): Promise<{ erro?: string }> {
  const g = configGeral();
  const app = await aplicacaoDaRedeAtual();
  if (g.modo !== 'producao' || !app) return { erro: 'A rede ainda não está configurada.' };
  try {
    const id = await conferirLoginGoogle(credencial, g.googleClientId, app.rede.dominio);
    const autorizador = await autorizadorDaRede(app.planilhas, id.email, app.rede.administradores);
    if (!autorizador.temPermissao('rede.instituicoes.gerenciar')) return { erro: `O e-mail ${id.email} não administra a rede.` };
    await iniciarSessaoRede(id.email, id.nome);
    await registrarAuditoria(app.planilhas, {
      usuario: id.email,
      acao: 'entrada',
      entidade: 'rede',
    });
    return {};
  } catch (erro) {
    if (erro instanceof ErroLogin) return { erro: erro.message };
    throw erro;
  }
}

export async function acaoSairDaRede() {
  await encerrarSessaoRede();
  redirect('/rede/entrar');
}

/** Prepara a estrutura de uma instituição e volta para a conferência dela. */
export async function acaoPrepararEstrutura(f: FormData) {
  const id = texto(f, 'id');
  let mensagem = '';
  await executar(
    `/rede?conferir=${encodeURIComponent(id)}`,
    '',
    async (a) => {
      const i = (await painelDaRede(a.app.planilhas, a.autorizador)).instituicoes.find((x) => x.id === id);
      if (!i) throw new ErroRede('Instituição não encontrada.');
      mensagem = `${i.nome}: ${resumoDaPreparacao(await prepararInstituicao(a, i))}`;
    },
    () => mensagem,
  );
}

/**
 * Prepara a estrutura de todas as instituições ativas e em preparação (as
 * suspensas ficam de fora). Uma que falhar não impede as outras.
 */
export async function acaoPrepararEstruturaDeTodas() {
  const a = await adm();
  const instituicoes = (await painelDaRede(a.app.planilhas, a.autorizador)).instituicoes.filter((i) => i.situacao !== 'suspensa');
  const certas: string[] = [];
  const falhas: string[] = [];
  for (const i of instituicoes) {
    try {
      const r = await prepararInstituicao(a, i);
      const algo = r.estrutura.abasCriadas.length || r.estrutura.registrosIniciais || r.pasta?.criadas.length;
      certas.push(`${i.nome} (${algo ? 'atualizada' : 'já estava em dia'}${r.pasta?.falhas.length ? `; não deu certo: ${r.pasta.falhas.map((x) => x.nome).join(', ')}` : ''})`);
    } catch (erro) {
      if (!conhecido(erro)) throw erro;
      falhas.push((erro as Error).message);
    }
  }
  const params = new URLSearchParams();
  if (certas.length) params.set('ok', `Estrutura preparada: ${certas.join('; ')}.`);
  if (falhas.length) params.set('erro', falhas.join(' '));
  if (!certas.length && !falhas.length) params.set('ok', 'Nenhuma instituição ativa ou em preparação.');
  redirect(`/rede?${params}`);
}
