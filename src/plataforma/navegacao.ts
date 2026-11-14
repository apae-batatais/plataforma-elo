/**
 * Monta a navegação da barra lateral a partir das permissões do usuário:
 * só aparece o que a pessoa pode abrir.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import type { GrupoNavegacao } from '@/ui/casca';
import { iconeDoApp } from './icones-dos-apps';
import { MODULOS } from './registro-modulos';

export function navegacaoDoUsuario(
  autorizador: Autorizador,
  estruturaPendente: boolean,
  opcoes: {
    estruturaDesatualizada?: boolean;
    alertasApps?: Record<string, string>;
    /** Com a Rede (ADR-018), só a Administração da rede prepara a estrutura: a tela sai do menu. */
    comRede?: boolean;
  } = {},
): GrupoNavegacao[] {
  const grupos: GrupoNavegacao[] = [];
  if (!estruturaPendente) {
    const apps = menuDoUsuario(MODULOS, autorizador.permissoes());
    grupos.push({
      itens: [
        { rotulo: 'Início', href: '/', icone: 'inicio' },
        { rotulo: 'Agenda', href: '/agenda', icone: 'agenda' },
        // Quem não pode ver pessoas (ex.: Funcionário) veria uma lista vazia.
        ...(autorizador.temPermissaoAlgumEscopo('core.pessoas.ver') ? [{ rotulo: 'Pessoas', href: '/nucleo/pessoas', icone: 'pessoas' as const }] : []),
        // Ficha do serviço (ligações entre apps). "Fichas de serviço" evita confundir com o cadastro, em Administração.
        ...(autorizador.temPermissaoAlgumEscopo('plataforma.servicos.ver') ? [{ rotulo: 'Fichas de serviço', href: '/servicos', icone: 'servicos' as const }] : []),
      ],
    });
    if (apps.length) {
      grupos.push({
        titulo: 'Apps',
        itens: apps.map((a) => ({
          rotulo: a.nome,
          href: a.rota,
          icone: iconeDoApp(a.id),
          alerta: opcoes.alertasApps?.[a.rota],
          filhos: a.itens.map((i) => ({ rotulo: i.rotulo, href: i.href, secao: i.secao })),
        })),
      });
    }
  }
  const admin: GrupoNavegacao['itens'] = [];
  if (!estruturaPendente && autorizador.temPermissao('core.acessos.gerenciar')) admin.push({ rotulo: 'Acessos', href: '/admin/acessos', icone: 'acessos' });
  if (!estruturaPendente && autorizador.temPermissao('core.organizacao.gerenciar'))
    admin.push({ rotulo: 'Áreas', href: '/admin/areas', icone: 'areas' }, { rotulo: 'Serviços', href: '/admin/servicos', icone: 'servicos' });
  if (!opcoes.comRede && autorizador.temPermissao('core.organizacao.gerenciar'))
    admin.push({
      rotulo: 'Estrutura das planilhas',
      href: '/admin/estrutura',
      icone: 'planilhas',
      alerta: opcoes.estruturaDesatualizada ? 'Atualizar' : undefined,
    });
  if (admin.length) grupos.push({ titulo: 'Administração', itens: admin });
  if (!estruturaPendente) grupos.push({ titulo: 'Suporte', itens: [{ rotulo: 'Ajuda', href: '/ajuda', icone: 'ajuda' }] });
  return grupos;
}
