'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import {
  ErroTesouraria, excluirConta, incluirAjuste, reativarConta, salvarConta, salvarSaldosDoMes, tirarAjuste,
} from '@/modulos/orcamento/aplicacao/tesouraria';
import { CLASSES, lerValorEmReais, mesValido, TIPOS_CONTA, type Classe, type TipoConta } from '@/modulos/orcamento/dominio/tesouraria';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

async function contexto() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  return { usuario, app: await obterAplicacao() };
}

const conhecido = (e: unknown) => e instanceof ErroTesouraria || e instanceof ErroConflito || e instanceof ErroPermissao;
const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const MSG_VALOR = 'Use números, como 1.234,56.';

/** Volta para a página com a mensagem no endereço (mesmo padrão da Previsão). */
async function executar(pagina: string, sucesso: string, acao: (ctx: Awaited<ReturnType<typeof contexto>>) => Promise<unknown>) {
  const ctx = await contexto();
  let destino: string;
  const sep = pagina.includes('?') ? '&' : '?';
  try {
    await acao(ctx);
    destino = `${pagina}${sep}ok=${encodeURIComponent(sucesso)}`;
  } catch (erro) {
    if (!conhecido(erro)) throw erro;
    destino = `${pagina}${sep}erro=${encodeURIComponent((erro as Error).message)}`;
  }
  revalidatePath('/orcamento/tesouraria', 'layout');
  redirect(destino);
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

export async function acaoSalvarConta(f: FormData) {
  const id = texto(f, 'id');
  const tipo = texto(f, 'tipo');
  const classe = texto(f, 'classe');
  await executar('/orcamento/tesouraria/contas', id ? 'Conta alterada.' : 'Conta cadastrada.', ({ usuario, app }) =>
    salvarConta(
      app.planilhas,
      usuario.autorizador,
      {
        banco: texto(f, 'banco'),
        agencia: texto(f, 'agencia'),
        conta: texto(f, 'conta'),
        tipo: (TIPOS_CONTA as readonly string[]).includes(tipo) ? (tipo as TipoConta) : ('' as TipoConta),
        classe: (CLASSES as readonly string[]).includes(classe) ? (classe as Classe) : ('' as Classe),
        fonteId: texto(f, 'fonte_id') || null,
        unidade: texto(f, 'unidade') || null,
      },
      id ? { id, versao: Number(texto(f, 'versao')) } : undefined,
    ),
  );
}

export async function acaoExcluirConta(f: FormData) {
  await executar('/orcamento/tesouraria/contas', 'Conta excluída. Ela fica guardada em “Contas excluídas” e os saldos já informados continuam valendo.', ({ usuario, app }) =>
    excluirConta(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

export async function acaoReativarConta(f: FormData) {
  await executar('/orcamento/tesouraria/contas', 'Conta reativada.', ({ usuario, app }) =>
    reativarConta(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}

// ---------------------------------------------------------------------------
// Saldos do mês e ajustes
// ---------------------------------------------------------------------------

const paginaSaldos = (mes: string) => `/orcamento/tesouraria?mes=${mesValido(mes) ? mes : ''}`;

export async function acaoSalvarSaldos(f: FormData) {
  const mes = texto(f, 'mes');
  await executar(paginaSaldos(mes), 'Saldos do mês salvos.', ({ usuario, app }) => {
    const linhas: { contaId: string; valor: number | null; versao?: number }[] = [];
    for (const [nome, v] of f.entries()) {
      if (!nome.startsWith('saldo_')) continue;
      const contaId = nome.slice('saldo_'.length);
      const valor = lerValorEmReais(String(v));
      if (valor === 'invalido') throw new ErroTesouraria(MSG_VALOR);
      const versao = texto(f, `versao_${contaId}`);
      linhas.push({ contaId, valor, versao: versao ? Number(versao) : undefined });
    }
    return salvarSaldosDoMes(app.planilhas, usuario.autorizador, mes, linhas).then((r) => {
      if (r.gravados === 0) throw new ErroTesouraria('Nenhum saldo mudou. Informe ou altere algum saldo antes de salvar.');
    });
  });
}

export async function acaoIncluirAjuste(f: FormData) {
  const mes = texto(f, 'mes');
  await executar(paginaSaldos(mes), 'Ajuste adicionado.', ({ usuario, app }) => {
    const valor = lerValorEmReais(texto(f, 'valor'));
    if (valor === 'invalido' || valor === null) throw new ErroTesouraria(MSG_VALOR);
    return incluirAjuste(app.planilhas, usuario.autorizador, { contaId: texto(f, 'conta_id'), mes, valor, motivo: texto(f, 'motivo') });
  });
}

export async function acaoTirarAjuste(f: FormData) {
  await executar(paginaSaldos(texto(f, 'mes')), 'Ajuste tirado. Ele fica registrado, mas não entra mais nos totais.', ({ usuario, app }) =>
    tirarAjuste(app.planilhas, usuario.autorizador, texto(f, 'id'), Number(texto(f, 'versao'))),
  );
}
