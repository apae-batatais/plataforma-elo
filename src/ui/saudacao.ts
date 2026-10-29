/**
 * Cumprimento da tela inicial. Usa o primeiro nome só quando o usuário é uma
 * pessoa; contas de setor ou órgão (Diretoria, Setor de Compras, Financeiro…)
 * recebem só "Bom dia", sem nome.
 */
const PALAVRAS_DE_SETOR = new Set([
  'administracao', 'apae', 'assistencia', 'comissao', 'compras', 'conselho', 'contabilidade', 'coordenacao',
  'departamento', 'diretoria', 'educacao', 'equipe', 'escola', 'financeiro', 'gerencia', 'presidencia',
  'recepcao', 'rh', 'saude', 'secretaria', 'servico', 'setor', 'tecnico', 'tesouraria', 'unidade',
]);

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function primeiroNomeDaPessoa(nome: string | null | undefined): string | null {
  const primeira = (nome ?? '').replace(/\(.*?\)/g, '').trim().split(/\s+/)[0] ?? '';
  if (!primeira || primeira.includes('@')) return null;
  if (PALAVRAS_DE_SETOR.has(semAcento(primeira).replace(/[^a-z]/g, ''))) return null;
  return primeira;
}

export function cumprimento(periodo: string, nome: string | null | undefined): string {
  const pessoa = primeiroNomeDaPessoa(nome);
  return pessoa ? `${periodo}, ${pessoa}` : periodo;
}
