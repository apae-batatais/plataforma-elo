import Link from 'next/link';
import { situacaoDaEstrutura } from '@/plataforma/estrutura';
import { cumprimento } from '@/ui/saudacao';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { resumoFolha } from '@/modulos/orcamento/aplicacao/folha';
import { contadoresComunicacao } from '@/modulos/comunicacao/aplicacao/pedidos';
import { pendenciasDaPessoa as pendenciasConhecimento } from '@/modulos/conhecimento/aplicacao/publicacoes';
import { contadoresRequisicoes } from '@/modulos/requisicoes/aplicacao/requisicoes';
import { painelDeAcessos } from '@/nucleo/acesso/gestao';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { APPS_PLANEJADOS } from '@/plataforma/apps-planejados';
import { MODULOS } from '@/plataforma/registro-modulos';
import { usuarioLogado } from '@/plataforma/sessao';
import { ICONES, IconeAreas, IconeAtencao, IconeChave, IconeCerto, IconePessoas, IconeSeta, IconeServicos } from '@/ui/icones';
import { agruparPorFamilia } from '@/plataforma/familias';
import { iconeDoApp } from '@/plataforma/icones-dos-apps';
import { agruparPendencias } from '@/plataforma/pendencias';
import { appDoCaminho } from '@/ui/cor-do-app';
import { CabecalhoPagina, Etiqueta } from '@/ui/pagina';
import { appsComPendenciaVencida } from '@/plataforma/pendencias-vencidas';

interface Pendencia {
  /** Id do app de origem; sem app, é da plataforma. */
  app?: string;
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
  vencida = false,
  neutro = false,
}: {
  href: string;
  icone: ReactNode;
  nome: string;
  descricao: string;
  atalhos?: { rotulo: string; href: string; vencida?: boolean }[];
  /** Família de apps: o cartão usa a cor padrão, não a de um app só. */
  neutro?: boolean;
  /** Pendência com prazo vencida neste app: anel que pulsa (o alerta também vai escrito, com ícone). */
  vencida?: boolean;
}) {
  return (
    <li data-app={neutro ? undefined : appDoCaminho(href)} className={`cartao-brilho flex h-full flex-col rounded-cartao border border-borda bg-superficie ${vencida ? 'anel-pulsante' : ''}`}>
      <Link href={href} className="group flex flex-1 gap-4 rounded-t-cartao p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-destaque-suave text-destaque">{icone}</span>
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-lg font-bold text-texto group-hover:text-destaque">
            {nome}
            <IconeSeta tamanho={18} className="transition-transform group-hover:translate-x-0.5" />
          </span>
          <span className="mt-0.5 block text-sm text-texto-suave">{descricao}</span>
          {vencida && (
            <span className="mt-2 block">
              <Etiqueta tipo="erro">
                <IconeAtencao tamanho={14} />
                <span className="ml-1">Pendência vencida</span>
              </Etiqueta>
            </span>
          )}
        </span>
      </Link>
      {atalhos && atalhos.length > 0 && (
        <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-borda px-5 py-3 text-sm">
          {atalhos.map((a) => (
            <li key={a.href}>
              <Link href={a.href} data-app={neutro ? appDoCaminho(a.href) : undefined} className="inline-flex items-center gap-1 font-semibold text-destaque hover:underline">
                {a.rotulo}
                {a.vencida && (
                  <>
                    <IconeAtencao tamanho={14} />
                    <span className="text-xs font-bold text-erro">pendência vencida</span>
                  </>
                )}
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
  const vencidas = await appsComPendenciaVencida(app.planilhas, a);
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
          app: 'orcamento',
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
          app: 'requisicoes',
          texto: n(c.aprovar, 'requisição espera a sua aprovação', 'requisições esperam a sua aprovação'),
          detalhe: 'Aprove, devolva para ajuste ou recuse.',
          href: '/requisicoes/aprovar',
          acao: 'Ver requisições',
        });
      }
      if (c.espacosDecidir > 0) {
        pendencias.push({
          app: 'requisicoes',
          texto: n(c.espacosDecidir, 'reserva de espaço espera a sua decisão', 'reservas de espaço esperam a sua decisão'),
          detalhe: 'Veja o conflito de horário e aprove, devolva ou recuse.',
          href: '/requisicoes/espacos',
          acao: 'Decidir',
        });
      }
      if (c.veiculosDecidir > 0) {
        pendencias.push({
          app: 'requisicoes',
          texto: n(c.veiculosDecidir, 'pedido de veículo espera a sua decisão', 'pedidos de veículo esperam a sua decisão'),
          detalhe: 'Veja o conflito de horário e aprove, devolva ou recuse.',
          href: '/requisicoes/veiculos/pedidos',
          acao: 'Decidir',
        });
      }
      if (c.veiculosUsar > 0) {
        pendencias.push({
          app: 'requisicoes',
          texto: n(c.veiculosUsar, 'veículo para confirmar o uso', 'veículos para confirmar o uso'),
          detalhe: 'A saída já passou: diga como foi o uso e informe a quilometragem.',
          href: '/requisicoes/veiculos/pedidos',
          acao: 'Confirmar uso',
        });
      }
      if (c.espacosFechar > 0) {
        pendencias.push({
          app: 'requisicoes',
          texto: n(c.espacosFechar, 'reserva para registrar o uso', 'reservas para registrar o uso'),
          detalhe: 'A hora de fim já passou: diga se o espaço foi usado sem ou com problema.',
          href: '/requisicoes/espacos',
          acao: 'Registrar uso',
        });
      }
      if (c.atender > 0) {
        pendencias.push({
          app: 'requisicoes',
          texto: n(c.atender, 'requisição está na fila do seu setor', 'requisições estão na fila do seu setor'),
          detalhe: 'Aprovadas, esperando atendimento.',
          href: '/requisicoes/atender',
          acao: 'Atender',
        });
      }
      if (c.devolvidas > 0) {
        pendencias.push({
          app: 'requisicoes',
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
  if (a.temPermissaoAlgumEscopo('comunicacao.acessar')) {
    try {
      const c = await contadoresComunicacao(app.planilhas, a);
      const n = (x: number, um: string, varios: string) => `${x} ${x === 1 ? um : varios}`;
      if (c.devolvidos > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.devolvidos, 'pedido seu foi devolvido para você ajustar', 'pedidos seus foram devolvidos para você ajustar'),
          detalhe: 'Veja o que a Comunicação pediu e reenvie.',
          href: '/comunicacao',
          acao: 'Ajustar',
        });
      }
      if (c.revisar > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.revisar, 'pedido aguarda revisão', 'pedidos aguardam revisão'),
          detalhe: 'Comece a revisão, devolva ou envie para aprovação.',
          href: '/comunicacao/pedidos?fila=revisar',
          acao: 'Revisar',
        });
      }
      if (c.urgentes > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.urgentes, 'pedido urgente na revisão', 'pedidos urgentes na revisão'),
          detalhe: 'Pedidos feitos fora da antecedência mínima.',
          href: '/comunicacao/pedidos?fila=revisar',
          acao: 'Ver urgentes',
        });
      }
      if (c.publicarHoje > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.publicarHoje, 'pedido para publicar hoje', 'pedidos para publicar hoje'),
          detalhe: 'Já estão agendados para hoje.',
          href: '/comunicacao/pedidos?fila=agendados',
          acao: 'Ver agendados',
        });
      }
      if (c.enviosFalharam > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.enviosFalharam, 'e-mail não saiu', 'e-mails não saíram'),
          detalhe: 'O envio automático falhou. Tente de novo ou envie à mão.',
          href: '/comunicacao/pedidos?fila=agendados',
          acao: 'Ver agendados',
        });
      }
      if (c.aprovar > 0) {
        pendencias.push({
          app: 'comunicacao',
          texto: n(c.aprovar, 'pedido aguarda a sua aprovação', 'pedidos aguardam a sua aprovação'),
          detalhe: 'Aprove, peça ajustes ou recuse.',
          href: '/comunicacao/pedidos?fila=aprovar',
          acao: 'Aprovar',
        });
      }
    } catch {
      // Planilha da Comunicação ainda não configurada: a página do app explica.
    }
  }
  if (a.temPermissaoAlgumEscopo('conhecimento.ler')) {
    try {
      const c = await pendenciasConhecimento(app.planilhas, a);
      if (c.total > 0) {
        pendencias.push({
          app: 'conhecimento',
          texto: `${c.total} ${c.total === 1 ? 'documento aguarda' : 'documentos aguardam'} a sua ciência ou teste`,
          detalhe: c.vencidas > 0 ? `${c.vencidas} ${c.vencidas === 1 ? 'está vencido' : 'estão vencidos'}, com mais de 15 dias sem ciência.` : 'Leia, faça o teste quando houver e confirme que está de acordo.',
          href: c.total === 1 ? `/conhecimento/${c.itens[0].id}` : '/conhecimento/meus-documentos',
          acao: 'Ler e dar ciência',
        });
      }
    } catch {
      // Planilha da Base de Conhecimento ainda não configurada: a página do app explica.
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
          <p className="mt-3 flex items-center gap-3 rounded-cartao border border-borda bg-superficie px-5 py-4 text-texto-suave">
            <span className="flex size-8 items-center justify-center rounded-full bg-sucesso-fundo text-sucesso">
              <IconeCerto tamanho={18} />
            </span>
            Nada pendente por aqui.
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {agruparPendencias(pendencias, apps.map((x) => x.id)).map((g) => {
              const doApp = g.app ? apps.find((x) => x.id === g.app) : undefined;
              const nome = doApp?.nome ?? 'Plataforma';
              const Icone = ICONES[g.app ? iconeDoApp(g.app) : 'acessos'];
              return (
                <li key={g.app ?? 'plataforma'} data-app={g.app ?? undefined} className="overflow-hidden rounded-cartao border border-borda bg-superficie">
                  <div className="flex items-center gap-3 border-b border-borda bg-destaque-suave px-5 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-superficie text-destaque">
                      <Icone tamanho={20} />
                    </span>
                    <h3 className="font-bold text-texto">{nome}</h3>
                    <span className="ml-auto text-sm text-texto-suave">
                      {g.itens.length} {g.itens.length === 1 ? 'pendência' : 'pendências'}
                    </span>
                  </div>
                  <ul className="divide-y divide-borda">
                    {g.itens.map((p) => (
                      <li key={String(p.texto)} className="flex flex-wrap items-center gap-4 px-5 py-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">{p.texto}</p>
                          <p className="text-sm text-texto-suave">{p.detalhe}</p>
                        </div>
                        {p.acao && (
                          <Link
                            href={p.href}
                            className="inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-destaque hover:bg-destaque-suave"
                          >
                            {p.acao}
                            <IconeSeta tamanho={16} />
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
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
          {agruparPorFamilia(apps).map((g) => {
            if (g.tipo === 'familia') {
              const Icone = ICONES[g.familia.icone];
              const primeiro = g.apps[0];
              return (
                <CartaoApp
                  key={g.id}
                  neutro
                  href={primeiro.itens[0]?.href ?? primeiro.rota}
                  icone={<Icone tamanho={24} />}
                  nome={g.familia.nome}
                  descricao={g.familia.descricao}
                  atalhos={g.apps.map((x) => ({ rotulo: x.nome, href: x.itens[0]?.href ?? x.rota, vencida: vencidas.has(x.id) }))}
                  vencida={g.apps.some((x) => vencidas.has(x.id))}
                />
              );
            }
            const x = g.app;
            const Icone = ICONES[iconeDoApp(x.id)];
            return (
              <CartaoApp
                key={x.id}
                href={x.itens[0]?.href ?? x.rota}
                icone={<Icone tamanho={24} />}
                nome={x.nome}
                descricao={x.descricao}
                atalhos={x.itens.slice(1, 4)}
                vencida={vencidas.has(x.id)}
              />
            );
          })}
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
              <li key={x.nome} className="rounded-cartao border border-dashed border-borda-forte p-5">
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
