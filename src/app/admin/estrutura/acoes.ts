'use server';

import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { prepararEstrutura } from '@/nucleo/estrutura/preparar';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { TABELAS_DOS_MODULOS } from '@/plataforma/registro-modulos';
import { usuarioLogado } from '@/plataforma/sessao';

export async function prepararEstruturaAgora() {
  const usuario = await usuarioLogado();
  if (!usuario?.autorizador.temPermissao('core.organizacao.gerenciar')) redirect('/');
  const app = await obterAplicacao();

  const r = await prepararEstrutura(app.planilhas, TABELAS_DOS_MODULOS, usuario.email);
  await registrarAuditoria(app.planilhas, {
    usuario: usuario.email,
    acao: 'estrutura',
    entidade: 'planilhas',
    detalhes: { abasCriadas: r.abasCriadas, registrosIniciais: r.registrosIniciais },
  });
  const texto =
    r.abasCriadas.length === 0 && r.registrosIniciais === 0
      ? 'Tudo já estava preparado. Nada foi alterado.'
      : `Abas criadas: ${r.abasCriadas.length ? r.abasCriadas.join('; ') : 'nenhuma'}. Registros iniciais: ${r.registrosIniciais}.`;
  redirect(`/admin/estrutura?resultado=${encodeURIComponent(texto)}`);
}
