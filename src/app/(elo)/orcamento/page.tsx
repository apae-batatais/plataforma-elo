import { redirect } from 'next/navigation';
import { manifesto } from '@/modulos/orcamento';
import { veResumoDaFolha } from '@/modulos/orcamento/aplicacao/entrada';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { usuarioLogado } from '@/plataforma/sessao';

/**
 * Ponto de entrada do Orçamento: a Visão geral para quem vê o painel ou os saldos; o Resumo da folha
 * para quem só vê a folha; os demais (ex.: Compras) vão para o primeiro item do seu menu.
 */
export default async function EntradaDoOrcamento() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const quem = usuario.autorizador;
  if (quem.temPermissao('orcamento.painel.ver') || quem.temPermissao('orcamento.tesouraria.ver')) redirect('/orcamento/visao-geral');
  if (veResumoDaFolha(quem)) redirect('/orcamento/resumo');
  const [app] = menuDoUsuario([manifesto], quem.permissoes());
  redirect(app?.itens[0]?.href ?? '/');
}
