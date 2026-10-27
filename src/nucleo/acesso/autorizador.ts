/**
 * Regras de acesso da plataforma (camada de aplicação).
 *
 * Permissões são textos "<modulo>.<recurso>.<acao>", ligadas a perfis.
 * Um usuário recebe perfis por atribuição, com escopo:
 * - global: vale para toda a instituição;
 * - unidade ou área: vale para os serviços daquela unidade ou área;
 * - serviço: vale para aquele serviço.
 * Atribuições fora da vigência (inicio/fim) não valem.
 */
import type {
  EscopoTipo,
  RegAtribuicao,
  RegPerfilPermissao,
  RegPessoa,
  RegServico,
  RegUsuario,
  RegVinculoFamiliar,
  RegVinculoServico,
} from '@/nucleo/estrutura/tabelas';

export interface DadosDeAcesso {
  usuarios: RegUsuario[];
  atribuicoes: RegAtribuicao[];
  perfilPermissoes: RegPerfilPermissao[];
  servicos: RegServico[];
}

export interface DadosDePessoas {
  pessoas: RegPessoa[];
  vinculosServico: RegVinculoServico[];
  vinculosFamiliares: RegVinculoFamiliar[];
}

const hojeISO = () => new Date().toISOString().slice(0, 10);

function vigente(r: { ativo: boolean; inicio: string | null; fim: string | null }, hoje: string) {
  return r.ativo && (!r.inicio || r.inicio <= hoje) && (!r.fim || r.fim >= hoje);
}

export class Autorizador {
  private readonly atribuicoes: { perfil: string; escopoTipo: EscopoTipo; escopo: string | null }[];
  private readonly permissoesPorPerfil = new Map<string, Set<string>>();
  readonly pessoaId: string | null;

  constructor(
    readonly email: string,
    private readonly dados: DadosDeAcesso,
    opcoes: { administradorInicial?: boolean; hoje?: string } = {},
  ) {
    const hoje = opcoes.hoje ?? hojeISO();
    const conta = dados.usuarios.find((u) => u.ativo && u.email === email);
    this.pessoaId = conta?.pessoa_id ?? null;

    this.atribuicoes = conta
      ? dados.atribuicoes
          .filter((a) => a.usuario_email === email && vigente(a, hoje))
          .map((a) => ({ perfil: a.perfil, escopoTipo: a.escopo_tipo, escopo: a.escopo }))
      : [];
    // Administradores iniciais (configuração da hospedagem) conseguem preparar a
    // estrutura e cadastrar os primeiros acessos, mesmo com as planilhas vazias.
    if (opcoes.administradorInicial) {
      this.atribuicoes.push({ perfil: 'administrador_plataforma', escopoTipo: 'global', escopo: null });
    }
    for (const pp of dados.perfilPermissoes.filter((x) => x.ativo)) {
      if (!this.permissoesPorPerfil.has(pp.perfil)) this.permissoesPorPerfil.set(pp.perfil, new Set());
      this.permissoesPorPerfil.get(pp.perfil)!.add(pp.permissao);
    }
    if (opcoes.administradorInicial) {
      const adm = this.permissoesPorPerfil.get('administrador_plataforma') ?? new Set<string>();
      ['core.organizacao.gerenciar', 'core.acessos.gerenciar', 'core.auditoria.ver'].forEach((p) => adm.add(p));
      this.permissoesPorPerfil.set('administrador_plataforma', adm);
    }
  }

  /** O usuário tem conta ativa (ou é administrador inicial)? */
  get autorizado(): boolean {
    return this.atribuicoes.length > 0 || this.dados.usuarios.some((u) => u.ativo && u.email === this.email);
  }

  private permite(perfil: string, permissao: string) {
    return this.permissoesPorPerfil.get(perfil)?.has(permissao) ?? false;
  }

  /** Todas as permissões do usuário, em qualquer escopo. */
  permissoes(): Set<string> {
    const s = new Set<string>();
    for (const a of this.atribuicoes) this.permissoesPorPerfil.get(a.perfil)?.forEach((p) => s.add(p));
    return s;
  }

  temPermissaoAlgumEscopo(permissao: string): boolean {
    return this.atribuicoes.some((a) => this.permite(a.perfil, permissao));
  }

  /** Sem escopo: só vale atribuição global. Com serviço: vale global, do serviço, da unidade ou da área dele. */
  temPermissao(permissao: string, escopo?: { tipo: EscopoTipo; codigo: string }): boolean {
    const servico =
      escopo?.tipo === 'servico' ? this.dados.servicos.find((s) => s.codigo === escopo.codigo) : undefined;
    return this.atribuicoes.some((a) => {
      if (!this.permite(a.perfil, permissao)) return false;
      if (a.escopoTipo === 'global') return true;
      if (!escopo) return false;
      if (a.escopoTipo === escopo.tipo && a.escopo === escopo.codigo) return true;
      if (servico && a.escopoTipo === 'unidade' && a.escopo === servico.unidade) return true;
      if (servico && a.escopoTipo === 'area' && a.escopo === servico.area) return true;
      return false;
    });
  }

  /**
   * Quem pode ver uma pessoa: quem tem "core.pessoas.ver" global; a própria
   * pessoa; quem tem a permissão no serviço em que ela está; quem tem a
   * permissão no serviço de um atendido de quem ela é familiar; e quem a
   * cadastrou, enquanto ela ainda não tem vínculo com serviço.
   */
  podeVerPessoa(pessoaId: string, d: DadosDePessoas): boolean {
    if (this.temPermissao('core.pessoas.ver')) return true;
    if (this.pessoaId === pessoaId) return true;
    const vinculosAtivos = (id: string) => d.vinculosServico.filter((v) => v.ativo && v.pessoa_id === id && !v.saida);
    const noEscopo = (id: string) =>
      vinculosAtivos(id).some((v) => this.temPermissao('core.pessoas.ver', { tipo: 'servico', codigo: v.servico }));
    if (noEscopo(pessoaId)) return true;
    const familiarDeAtendido = d.vinculosFamiliares.some(
      (vf) => vf.ativo && !vf.fim && vf.relacionado_id === pessoaId && noEscopo(vf.pessoa_id),
    );
    if (familiarDeAtendido) return true;
    const pessoa = d.pessoas.find((p) => p.id === pessoaId);
    return Boolean(pessoa && pessoa.criado_por === this.email && vinculosAtivos(pessoaId).length === 0);
  }

  podeEditarPessoa(pessoaId: string, d: DadosDePessoas): boolean {
    return this.podeVerPessoa(pessoaId, d) && this.temPermissaoAlgumEscopo('core.pessoas.editar');
  }
}

export class ErroPermissao extends Error {
  constructor(mensagem = 'Você não tem permissão para esta ação.') {
    super(mensagem);
  }
}
