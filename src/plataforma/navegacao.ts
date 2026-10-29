/**
 * Monta a navegação da barra lateral a partir das permissões do usuário:
 * só aparece o que a pessoa pode abrir.
 */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { menuDoUsuario } from '@/nucleo/modulos/registro';
import type { GrupoNavegacao, NomeIcone } from '@/ui/casca';
import { MODULOS } from './registro-modulos';

const ICONE_DO_MODULO: Record<string, NomeIcone> = { calculator: 'orcamento', wallet: 'orcamento' };

export function navegacaoDoUsuario(autorizador: Autorizador, estruturaPendente: boolean): GrupoNavegacao[] {
  const grupos: GrupoNavegacao[] = [];
  if (!estruturaPendente) {
    const apps = menuDoUsuario(MODULOS, autorizador.permissoes());
    grupos.push({
      itens: [
        { rotulo: 'Início', href: '/', icone: 'inicio' },
        { rotulo: 'Pessoas', href: '/nucleo/pessoas', icone: 'pessoas' },
      ],
    });
    if (apps.length) {
      grupos.push({
        titulo: 'Apps',
        itens: apps.map((a) => ({
          rotulo: a.nome,
          href: a.rota,
          icone: ICONE_DO_MODULO[a.icone] ?? 'planilhas',
          filhos: a.itens.map((i) => ({ rotulo: i.rotulo, href: i.href, secao: i.secao })),
        })),
      });
    }
  }
  const admin: GrupoNavegacao['itens'] = [];
  if (!estruturaPendente && autorizador.temPermissao('core.acessos.gerenciar')) admin.push({ rotulo: 'Acessos', href: '/admin/acessos', icone: 'acessos' });
  if (!estruturaPendente && autorizador.temPermissao('core.organizacao.gerenciar')) admin.push({ rotulo: 'Áreas', href: '/admin/areas', icone: 'areas' }, { rotulo: 'Serviços', href: '/admin/servicos', icone: 'servicos' });
  if (autorizador.temPermissao('core.organizacao.gerenciar')) admin.push({ rotulo: 'Estrutura das planilhas', href: '/admin/estrutura', icone: 'planilhas' });
  if (admin.length) grupos.push({ titulo: 'Administração', itens: admin });
  if (!estruturaPendente) grupos.push({ titulo: 'Suporte', itens: [{ rotulo: 'Ajuda', href: '/ajuda', icone: 'ajuda' }] });
  return grupos;
}
