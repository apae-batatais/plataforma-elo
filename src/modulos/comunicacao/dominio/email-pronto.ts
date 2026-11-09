/**
 * E-mail pronto (release e artigo): monta o endereço que abre o Gmail já preenchido, com os
 * destinatários em cópia oculta. Se a lista deixar o endereço longo demais, ele sai sem os
 * destinatários e a tela mostra os e-mails para copiar.
 */

const LIMITE_DO_ENDERECO = 2000;
const BASE = 'https://mail.google.com/mail/?view=cm&fs=1';

export function montarEmailPronto(e: { destinatarios: string[]; assunto: string; corpo: string }): { url: string; enderecosNoLink: boolean; enderecos: string[] } {
  const resto = `&su=${encodeURIComponent(e.assunto)}&body=${encodeURIComponent(e.corpo)}`;
  const comEnderecos = `${BASE}&bcc=${encodeURIComponent(e.destinatarios.join(','))}${resto}`;
  const cabe = comEnderecos.length <= LIMITE_DO_ENDERECO;
  return { url: cabe ? comEnderecos : `${BASE}${resto}`, enderecosNoLink: cabe, enderecos: e.destinatarios };
}
