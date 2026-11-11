'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { ErroConflito } from '@/nucleo/armazenamento/tabela';
import { ErroRealizado, salvarRealizadoDoMes, type EntradaLinha } from '@/modulos/orcamento/aplicacao/realizado';
import { NATUREZAS_DESPESA, NATUREZAS_RECEITA, type Natureza } from '@/modulos/orcamento/dominio/realizado';
import { lerValorEmReais, mesValido } from '@/modulos/orcamento/dominio/tesouraria';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';

const texto = (f: FormData, campo: string) => String(f.get(campo) ?? '').trim();
const TODAS = new Set<string>([...NATUREZAS_DESPESA, ...NATUREZAS_RECEITA]);

export async function acaoSalvarRealizado(f: FormData) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const mes = texto(f, 'mes');
  const pagina = `/orcamento/execucao/realizado?mes=${mesValido(mes) ? mes : ''}`;
  let destino: string;
  try {
    const n = Math.min(Number(texto(f, 'quantidade')) || 0, 2000);
    const linhas: EntradaLinha[] = [];
    for (let i = 0; i < n; i++) {
      const c = (nome: string) => texto(f, `l${i}_${nome}`);
      const versao = c('versao');
      const valor = lerValorEmReais(c('valor'));
      if (valor === 'invalido') throw new ErroRealizado('Use números, como 1.234,56.');
      // Linha em branco (sem valor e sem versão gravada) é só espaço da grade: não entra.
      if (valor === null && !versao) continue;
      const tipo = c('tipo');
      if (tipo !== 'despesa' && tipo !== 'receita') throw new ErroRealizado('Tipo de linha inválido. Abra a página de novo.');
      const natureza = c('natureza');
      linhas.push({
        tipo,
        servico: c('servico') || null,
        grupoId: c('grupo') || null,
        fonteId: c('fonte'),
        natureza: (TODAS.has(natureza) ? natureza : '') as Natureza,
        valor,
        naoRecorrente: c('nr') === 'on',
        motivo: c('motivo') || null,
        observacao: c('obs') || null,
        versao: versao ? Number(versao) : undefined,
      });
    }
    const app = await obterAplicacao();
    const { gravados } = await salvarRealizadoDoMes(app.planilhas, usuario.autorizador, mes, linhas);
    const msg = gravados === 0 ? 'Nada mudou: não havia nada novo para salvar.' : 'Realizado do mês salvo.';
    destino = `${pagina}&ok=${encodeURIComponent(msg)}&salvo=1`;
  } catch (erro) {
    if (erro instanceof ErroConflito) {
      destino = `${pagina}&erro=${encodeURIComponent('Outra pessoa alterou o realizado deste mês depois que você abriu a página. Nada foi salvo. O que você digitou foi mantido: confira e salve de novo.')}`;
    } else if (erro instanceof ErroRealizado || erro instanceof ErroPermissao) {
      destino = `${pagina}&erro=${encodeURIComponent(erro.message)}`;
    } else throw erro;
  }
  revalidatePath('/orcamento/execucao', 'layout');
  redirect(destino);
}
