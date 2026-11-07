import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerSaldosDoMes, listarContas } from '@/modulos/orcamento/aplicacao/tesouraria';
import { mesAnterior, mesAtualBrasilia, mesValido } from '@/modulos/orcamento/dominio/tesouraria';
import { rotuloMes } from '@/modulos/orcamento/telas/formato';
import { SaldosDoMes, type LinhaTela } from '@/modulos/orcamento/telas/saldos-do-mes';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { Botao } from '@/ui/botao';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina } from '@/ui/pagina';
import { acaoIncluirAjuste, acaoSalvarSaldos, acaoTirarAjuste } from './acoes';

export const metadata: Metadata = { title: 'Saldos do mês' };

export default async function SaldosDoMesPagina({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: pedido } = await searchParams;
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const atual = mesAtualBrasilia();
  // Padrão: o mês anterior, porque o extrato do mês fecha no último dia.
  const mes = pedido && mesValido(pedido) && pedido <= atual ? pedido : mesAnterior(atual);
  const app = await obterAplicacao();
  const s = await lerSaldosDoMes(app.planilhas, usuario.autorizador, mes);
  const podeEditar = usuario.autorizador.temPermissao('orcamento.tesouraria.editar');
  const { fontes } = await listarContas(app.planilhas, usuario.autorizador);

  const descrever = (c: { banco: string; agencia: string | null; conta: string | null }) =>
    [c.banco, c.agencia && `ag. ${c.agencia}`, c.conta && `conta ${c.conta}`].filter(Boolean).join(' · ');
  const linhas: LinhaTela[] = s.linhas.map((l) => ({
    contaId: l.conta.id,
    descricao: descrever(l.conta),
    tipo: l.conta.tipo,
    classe: l.conta.classe,
    fonte: l.conta.fonte_id ? (fontes[l.conta.fonte_id] ?? null) : null,
    excluida: !l.conta.ativo,
    saldo: l.saldo?.saldo ?? null,
    versao: l.saldo?.versao ?? null,
    saldoAnterior: l.saldoAnterior,
    ajustes: l.ajustes.map((a) => ({ id: a.id, versao: a.versao, valor: a.valor, motivo: a.motivo })),
  }));
  const nomes = s.pendentes.map((p) => p.nome);
  const n = nomes.length;

  return (
    <div>
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Orçamento', href: '/orcamento' }, { rotulo: 'Tesouraria' }, { rotulo: 'Saldos do mês' }]}
        titulo={`Saldos de ${rotuloMes(mes)}`}
        descricao="O saldo de cada conta no último dia do mês, conforme o extrato. O Elo soma por classe: livre disponível, reserva e vinculada."
        acoes={
          <form method="get" className="flex flex-wrap items-end gap-2">
            <Campo rotulo="Mês">
              <input type="month" name="mes" defaultValue={mes} max={atual} required className={`${estiloEntrada} !mt-1`} />
            </Campo>
            <Botao type="submit" variante="secundario">
              Ver mês
            </Botao>
          </form>
        }
      />

      {s.linhas.length > 0 &&
        (n > 0 ? (
          <div className="mb-6">
            <Aviso tipo="atencao">
              {n} {n === 1 ? 'conta sem saldo' : 'contas sem saldo'} em {rotuloMes(mes)}: {nomes.join('; ')}.
            </Aviso>
          </div>
        ) : (
          <div className="mb-6">
            <Aviso tipo="sucesso">Todas as contas têm saldo em {rotuloMes(mes)}.</Aviso>
          </div>
        ))}

      <SaldosDoMes
        key={`${mes}-${Date.now()}`}
        mes={mes}
        rotuloMes={rotuloMes(mes)}
        rotuloMesAnterior={rotuloMes(mesAnterior(mes))}
        linhas={linhas}
        totaisAnterior={s.totaisAnterior}
        podeEditar={podeEditar}
        salvar={acaoSalvarSaldos}
        incluirAjuste={acaoIncluirAjuste}
        tirarAjuste={acaoTirarAjuste}
      />
    </div>
  );
}
