/**
 * Busca de pessoas atendidas para a busca única (ADR-024).
 * Só aparece quem `Autorizador.podeVerPessoa` permite, e só para quem tem `core.pessoas.ver` em algum escopo.
 * Cada busca que devolve alguém grava uma leitura na auditoria: quem leu e quais pessoas, nunca o termo (pode ser um nome).
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import type { Planilhas } from '@/nucleo/armazenamento/tabela';
import { contem, MAX_RESULTADOS_POR_APP, type ResultadoDaBusca } from '@/nucleo/modulos/agenda-busca';
import { listarPessoasVisiveis } from './servico';

/** `termo` já vem normalizado (`termoDeBusca`). */
export async function buscarPessoas(p: Planilhas, quem: Autorizador, termo: string, agora = new Date()): Promise<ResultadoDaBusca[]> {
  if (!quem.temPermissaoAlgumEscopo('core.pessoas.ver')) return [];
  const achadas = (await listarPessoasVisiveis(p, quem)).filter((x) => contem(x.nome, termo)).slice(0, MAX_RESULTADOS_POR_APP);
  if (achadas.length)
    await registrarAuditoria(
      p,
      { usuario: quem.email, acao: 'leitura', entidade: 'pessoas', detalhes: { origem: 'busca', quantidade: achadas.length, pessoas: achadas.map((x) => x.id) } },
      agora,
    );
  return achadas.map((x) => ({
    app: 'nucleo',
    tipo: 'Pessoa',
    titulo: x.nome,
    apoio: x.servicos.length ? x.servicos.join(', ') : null,
    href: `/nucleo/pessoas?busca=${encodeURIComponent(x.nome)}`,
  }));
}
