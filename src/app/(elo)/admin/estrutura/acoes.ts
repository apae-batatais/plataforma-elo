'use server';

import { redirect } from 'next/navigation';
import { ErroArmazenamento } from '@/nucleo/armazenamento/armazenamento';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { esquecerSituacaoDaEstrutura } from '@/plataforma/estrutura';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { usuarioLogado } from '@/plataforma/sessao';

export async function prepararEstruturaAgora() {
  const usuario = await usuarioLogado();
  if (!usuario?.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();

  // Planilhas de módulos ainda não cadastradas em PLANILHAS ficam para depois,
  // sem impedir o preparo do Núcleo.
  const faltando = new Set<string>();
  for (const t of ESTRUTURA_DOS_MODULOS.tabelas ?? []) {
    try {
      app.planilhas.idDe(t.planilha);
    } catch {
      faltando.add(t.planilha);
    }
  }
  const estrutura = { ...ESTRUTURA_DOS_MODULOS, tabelas: (ESTRUTURA_DOS_MODULOS.tabelas ?? []).filter((t) => !faltando.has(t.planilha)) };
  let r;
  try {
    r = await prepararEstrutura(app.planilhas, estrutura, usuario.email, app.instituicao.unidades);
  } catch (erro) {
    if (!(erro instanceof ErroArmazenamento)) throw erro;
    redirect(`/admin/estrutura?resultado=${encodeURIComponent(`Não foi possível preparar: ${erro.message}`)}`);
  }
  await esquecerSituacaoDaEstrutura();
  await registrarAuditoria(app.planilhas, {
    usuario: usuario.email,
    acao: 'estrutura',
    entidade: 'planilhas',
    detalhes: { abasCriadas: r.abasCriadas, registrosIniciais: r.registrosIniciais, ajustes: r.ajustes },
  });
  const aviso = faltando.size
    ? ` Atenção: as planilhas ${[...faltando].map((x) => `"${x}"`).join(', ')} não estão cadastradas na variável PLANILHAS da Netlify; as abas delas não foram criadas.`
    : '';
  const texto =
    (r.abasCriadas.length === 0 && r.registrosIniciais === 0 && r.ajustes.length === 0
      ? 'Tudo já estava preparado. Nada foi alterado.'
      : `Abas criadas: ${r.abasCriadas.length ? r.abasCriadas.join('; ') : 'nenhuma'}. Registros iniciais: ${r.registrosIniciais}.${r.ajustes.length ? ` Ajustes: ${r.ajustes.join('; ')}.` : ''}`) + aviso;
  redirect(`/admin/estrutura?resultado=${encodeURIComponent(texto)}`);
}
