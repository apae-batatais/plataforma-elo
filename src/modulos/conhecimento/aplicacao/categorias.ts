/** Categorias da Base de Conhecimento. Quem pode: `conhecimento.categorias.gerenciar`. */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { CategoriasConhecimento, PublicacoesConhecimento } from '../dados/tabelas';
import { codigoDaCategoria, ErroConhecimento } from '../dominio/publicacao';
import { auditar, autoriaDe, PERM, type Opcoes } from './base';

/** Todas as categorias (ativas e desativadas). Qualquer pessoa com acesso ao app lê a lista. */
export async function listarCategorias(p: Planilhas, quem: Autorizador) {
  if (!quem.temPermissaoAlgumEscopo(PERM.acessar)) throw new ErroPermissao();
  const [categorias] = await lerTabelas(p, [CategoriasConhecimento] as const);
  return categorias.todos().map((c) => ({ id: c.id, versao: c.versao, codigo: c.codigo, nome: c.nome, ativo: c.ativo }));
}

export async function criarCategoria(p: Planilhas, quem: Autorizador, nomeBruto: string, opcoes: Opcoes = {}): Promise<{ id: string }> {
  if (!quem.temPermissao(PERM.categorias)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const nome = nomeBruto.trim().replace(/\s+/g, ' ');
  if (!nome) throw new ErroConhecimento('Informe o nome da categoria.');
  if (nome.length > 60) throw new ErroConhecimento('O nome da categoria passa de 60 caracteres.');
  const codigo = codigoDaCategoria(nome);
  if (!codigo) throw new ErroConhecimento('Use letras ou números no nome da categoria.');
  const [categorias] = await lerTabelas(p, [CategoriasConhecimento] as const);
  if (categorias.ativos().some((c) => c.codigo === codigo || c.nome.toLowerCase() === nome.toLowerCase())) throw new ErroConhecimento('Já existe uma categoria com este nome.');
  // Categoria desativada com o mesmo código: o código seguiria repetido; acrescenta um sufixo.
  const usados = new Set(categorias.todos().map((c) => c.codigo));
  let final = codigo;
  for (let i = 2; usados.has(final); i++) final = `${codigo}_${i}`;
  const nova = await inserir(p, CategoriasConhecimento, { codigo: final, nome }, autoriaDe(quem, agora));
  await auditar(p, quem, 'inclusao', 'CategoriasConhecimento', nova.id, ['codigo', 'nome'], agora);
  return { id: nova.id };
}

/** Desativa ou reativa. Categoria com publicações (que não estão arquivadas) não pode ser desativada. */
export async function mudarSituacaoCategoria(p: Planilhas, quem: Autorizador, id: string, versao: number, ativo: boolean, opcoes: Opcoes = {}): Promise<void> {
  if (!quem.temPermissao(PERM.categorias)) throw new ErroPermissao();
  const agora = opcoes.agora ?? new Date();
  const [categorias, publicacoes] = await lerTabelas(p, [CategoriasConhecimento, PublicacoesConhecimento] as const);
  const atual = categorias.porId(id);
  if (!atual) throw new ErroConhecimento('Categoria não encontrada.');
  if (atual.ativo === ativo) throw new ErroConhecimento(ativo ? 'Esta categoria já está ativa.' : 'Esta categoria já está desativada.');
  if (!ativo && publicacoes.ativos().some((x) => x.categoria === atual.codigo && x.situacao !== 'arquivada'))
    throw new ErroConhecimento('Mova ou arquive as publicações desta categoria antes de desativá-la.');
  await atualizar(p, CategoriasConhecimento, id, versao, { ativo }, autoriaDe(quem, agora));
  await auditar(p, quem, ativo ? 'alteracao' : 'encerramento', 'CategoriasConhecimento', id, ['ativo'], agora);
}
