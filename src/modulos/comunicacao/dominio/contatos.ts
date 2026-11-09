/** Regras puras dos contatos da imprensa: e-mail válido e sem repetir entre os ativos. */

const FORMATO_EMAIL = /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]+$/;

export const normalizarEmail = (e: string): string => e.trim().toLowerCase();

/** Erros (em português) do contato; lista vazia quando está tudo certo. `existentes` são só os contatos ativos. */
export function conferirContato(c: { nome: string; email: string }, existentes: { id: string; email: string }[], idAtual?: string): string[] {
  const erros: string[] = [];
  if (!c.nome.trim()) erros.push('Informe o nome do contato.');
  const email = normalizarEmail(c.email);
  if (!FORMATO_EMAIL.test(email)) erros.push('Informe um e-mail válido.');
  else if (existentes.some((x) => x.id !== idAtual && normalizarEmail(x.email) === email)) erros.push('Este e-mail já está cadastrado.');
  return erros;
}
