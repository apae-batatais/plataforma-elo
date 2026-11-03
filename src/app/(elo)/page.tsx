import Link from 'next/link';
import { situacaoDaEstrutura } from '@/plataforma/estrutura';
import { cumprimento } from '@/ui/saudacao';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { resumoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { contadoresRequisicoes } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { painelDeAcessos } from '@/nucleo/acesso/gestao';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { APPS_PLANEJADOS } from '@/plataforma/apps-planejados';
import { MODULOS } from '@/plataforma/registro-modulos';
import { usuarioLogado } from '@/plataforma/sessao';
import { IconeAreas, IconeAtencao, IconeChave, IconeCerto, IconeOrcamento, IconePessoas, IconeRequisicao, IconeSeta, IconeServicos } from '@/ui/icones';
import { CabecalhoPagina } from '@/ui/pagina';

interface Pendencia {
  texto: ReactNode;
  detalhe: string;
  href: string;
  acao: string;
}

function saudacao() {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  return hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
}

function CartaoApp({
  href,
  icone,
  nome,
  descricao,
  atalhos,
}: {
  href: string;
  icone: ReactNode;
  nome: string;
  descricao: string;
  atalhos?: { rotulo: string; href: string }[];
}) {
  return (
    <li className="flex flex-col rounded-xl border border-borda bg-superficie transition-colors hover:border-destaque/60">
      <Link href={href} className="group flex flex-1 gap-4 rounded-t-xl p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destaque-suave text-destaque">{icone}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-lg font-bold text-texto group-hover:text-destaque">
            {nome}
            <IconeSeta tamanho={18} className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-0.5 block text-sm text-texto-suave">{descricao}</span>
        </span>
      </Link>
      {atalhos && atalhos.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-borda px-5 py-3 text-sm">
          {atalhos.map((a) => (
            <li key={a.href}>
              <Link href={a.href} className="font-semibold text-destaque hover:underline">
                {a.rotulo}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function Portal() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const app = await obterAplicacao();
  const a = usuario.autorizador;

  const apps = menuDoUsuario(MODULOS, a.permissoes());
  const ativos = new Set(MODULOS.map((m) => m.nome));
  const planejados = APPS_PLANEJADOS.filter((x) => !ativos.has(x.nome));

  // O que precisa da atenção desta pessoa, conforme o perfil dela.
  const pendencias: Pendencia[] = [];
  if (usuario.perfis.length === 0) {
    pendencias.push({
      texto: 'Você ainda não tem perfil de acesso.',
      detalhe: 'Peça à administração da plataforma para atribuir o seu perfil.',
      href: '/',
      acao: '',
    });
  }
  if (a.temPermissao('orcamento.folha.editar')) {
    try {
      const r = await resumoFolha(app.planilhas, a);
      const n = (r.alertas?.semRateio ?? 0) + (r.alertas?.foraDe100 ?? 0);
      if (n > 0) {
        pendencias.push({
          texto: `${n} ${n === 1 ? 'funcionário está' : 'funcionários estão'} sem lotação válida`,
          detalhe: 'O custo deles não aparece em nenhum serviço no resumo por serviço.',
          href: '/orcamento/lotacao?atalho=pendentes',
          acao: 'Corrigir lotação',
        });
      }
    } catch {
      // Planilhas do Orçamento ainda não preparadas: a página do app explica.
    }
  }
  if (a.temPermissaoAlgumEscopo('requisicoes.acessar')) {
    try {
      const c = await contadoresRequisicoes(app.planilhas, a);
      const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`;
      if (c.aprovar > 0) {
        pendencias.push({
          texto: n(c.aprovar, 'requisição espera a sua aprovação', 'requisições esperam a sua aprovação'),
          detalhe: 'Aprove, devolva para ajuste ou recuse.',
          href: '/requisicoes/aprovar',
          acao: 'Ver requisições',
        });
      }
      if (c.atender > 0) {
        pendencias.push({
          texto: n(c.atender, 'requisição está na fila do seu setor', 'requisições estão na fila do seu setor'),
          detalhe: 'Aprovadas, esperando atendimento.',
          href: '/requisicoes/atender',
          acao: 'Atender',
        });
      }
      if (c.devolvidas > 0) {
        pendencias.push({
          texto: n(c.devolvidas, 'requisição sua foi devolvida para ajuste', 'requisições suas foram devolvidas para ajuste'),
          detalhe: 'Veja o que a coordenação pediu e reenvie.',
          href: '/requisicoes',
          acao: 'Ajustar',
        });
      }
    } catch {
      // Planilha das Requisições ainda não configurada: a página do app explica.
    }
  }
  if (a.temPermissao('core.organizacao.gerenciar')) {
    const est = await situacaoDaEstrutura();
    if (est?.desatualizada) {
      pendencias.push({
        texto: 'Há uma atualização do Elo esperando "Preparar estrutura"',
        detalhe: 'Até lá, perfis e permissões novos não valem e alguns itens do menu podem não aparecer para a equipe.',
        href: '/admin/estrutura',
        acao: 'Preparar estrutura',
      });
    }
  }
  if (a.temPermissao('core.acessos.gerenciar')) {
    const painel = await painelDeAcessos(app.planilhas, a);
    const semPerfil = painel.usuarios.filter((u) => u.ativo && !u.atribuicoes.some((x) => x.vigente)).length;
    if (semPerfil > 0) {
      pendencias.push({
        texto: `${semPerfil} ${semPerfil === 1 ? 'pessoa tem' : 'pessoas têm'} acesso, mas nenhum perfil`,
        detalhe: 'Elas entram na plataforma, mas não veem nenhum app.',
        href: '/admin/acessos',
        acao: 'Atribuir perfis',
      });
    }
  }

  const hoje = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date());

  return (
    <div className="space-y-10">
      <CabecalhoPagina titulo={cumprimento(saudacao(), usuario.nome)} descricao={<span className="first-letter:uppercase">{hoje}</span>} />

      <section aria-labelledby="t-atencao">
        <h2 id="t-atencao" className="text-lg font-bold">
          Precisa da sua atenção
        </h2>
        {pendencias.length === 0 ? (
          <p className="mt-3 flex items-center gap-3 rounded-xl border border-borda bg-superficie px-5 py-4 text-texto-suave">
            <span className="flex size-8 items-center justify-center rounded-full bg-sucesso-fundo text-sucesso">
              <IconeCerto tamanho={18} />
            </span>
            Nada pendente por aqui.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-superficie">
            {pendencias.map((p) => (
              <li key={String(p.texto)} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-aviso-fundo text-aviso">
                  <IconeAtencao tamanho={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.texto}</p>
                  <p className="text-sm text-texto-suave">{p.detalhe}</p>
                </div>
                {p.acao && (
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-destaque hover:bg-destaque-suave"
                  >
                    {p.acao}
                    <IconeSeta tamanho={16} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-apps">
        <h2 id="t-apps" className="text-lg font-bold">
          Seus apps
        </h2>
        <ul className="mt-3 grid gap-4 md:grid-cols-2">
          {usuario.autorizador.temPermissaoAlgumEscopo('core.pessoas.ver') && (
            <CartaoApp
              href="/nucleo/pessoas"
              icone={<IconePessoas tamanho={24} />}
              nome="Pessoas"
              descricao="Cadastro único: atendidos, familiares e equipe que você pode ver."
            />
          )}
          {apps.map((x) => (
            <CartaoApp
              key={x.id}
              href={x.itens[0]?.href ?? x.rota}
              icone={x.id === 'requisicoes' ? <IconeRequisicao tamanho={24} /> : <IconeOrcamento tamanho={24} />}
              nome={x.nome}
              descricao={x.descricao}
              atalhos={x.itens.slice(1, 4)}
            />
          ))}
          {a.temPermissao('core.acessos.gerenciar') && (
            <CartaoApp href="/admin/acessos" icone={<IconeChave tamanho={24} />} nome="Acessos" descricao="Quem entra na plataforma e com qual perfil." />
          )}
          {a.temPermissao('core.organizacao.gerenciar') && (
            <CartaoApp href="/admin/areas" icone={<IconeAreas tamanho={24} />} nome="Áreas" descricao="Áreas que agrupam os serviços (centros de custo)." />
          )}
          {a.temPermissao('core.organizacao.gerenciar') && (
            <CartaoApp href="/admin/servicos" icone={<IconeServicos tamanho={24} />} nome="Serviços" descricao="Serviços da instituição, por área e unidade." />
          )}
        </ul>
      </section>

      {planejados.length > 0 && (
        <section aria-labelledby="t-planejados">
          <h2 id="t-planejados" className="text-lg font-bold">
            Em construção
          </h2>
          <ul className="mt-3 grid gap-4 md:grid-cols-2">
            {planejados.map((x) => (
              <li key={x.nome} className="rounded-xl border border-dashed border-borda-forte p-5">
                <p className="font-bold">
                  {x.nome} <span className="ml-1 text-sm font-normal text-texto-suave">{x.fase}</span>
                </p>
                <p className="mt-0.5 text-sm text-texto-suave">{x.descricao}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
