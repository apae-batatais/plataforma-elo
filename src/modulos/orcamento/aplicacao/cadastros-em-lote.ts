/**
 * Grupos de gasto e fontes de recurso em lote: a pessoa cola uma lista
 * copiada de uma planilha, confere a prévia e confirma.
 *
 * - Grupos: Nome; Tipo (opcional: "RH" ou "Recursos Humanos"; vazio = despesa geral); Código da conta (opcional).
 * - Fontes: Nome; Natureza (pública ou própria); Uso (livre ou restrito); Código da conta (opcional).
 *
 * Nomes que já existem (inclusive entre os excluídos) ou repetidos na lista
 * são ignorados. Na confirmação, tudo é conferido de novo antes de gravar.
 */
import { ErroPermissao, type Autorizador } from '@/nucleo/acesso/autorizador';
import { inserirRegistros, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { registrarAuditoria } from '@/nucleo/auditoria/auditoria';
import { Fontes, GruposGasto } from '../dados/tabelas';
import { acharCodigoRepetido, chaveCodigoConta, ErroCodigoConta, limparCodigoConta } from '../dominio/codigo-conta';
import { nomeComparavel } from '../dominio/previsao';
import { ErroValidacaoFolha } from './folha';

export type TipoCadastro = 'grupo' | 'fonte';

export interface LinhaCadastroLote {
  linha: number;
  nome: string;
  rh?: boolean;
  natureza?: 'publica' | 'propria';
  uso?: 'livre' | 'restrita';
  codigo_conta?: string | null;
  situacao: 'ok' | 'ja_existe' | 'erro';
  problema: string | null;
}

function exigir(quem: Autorizador) {
  if (!quem.temPermissao('orcamento.previsao.editar')) throw new ErroPermissao();
}

const limpar = (t: string) => t.trim().replace(/\s+/g, ' ');

function lerNatureza(t: string): 'publica' | 'propria' | null {
  const n = nomeComparavel(t);
  if (['publica', 'publico', 'p', 'pub'].includes(n)) return 'publica';
  if (['propria', 'proprio', 'pr', 'prop'].includes(n)) return 'propria';
  return null;
}
function lerUso(t: string): 'livre' | 'restrita' | null {
  const n = nomeComparavel(t);
  if (['livre', 'l'].includes(n)) return 'livre';
  if (['restrita', 'restrito', 'r', 'vinculada', 'vinculado'].includes(n)) return 'restrita';
  return null;
}
function lerRh(t: string): boolean | null {
  const n = nomeComparavel(t);
  if (!n || ['geral', 'despesa geral', 'nao', 'n'].includes(n)) return false;
  if (['rh', 'recursos humanos', 'sim', 's', 'x'].includes(n)) return true;
  return null;
}

/** Lê a lista colada. Não grava nada. */
export async function analisarCadastrosEmLote(p: Planilhas, quem: Autorizador, tipo: TipoCadastro, texto: string): Promise<LinhaCadastroLote[]> {
  exigir(quem);
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const existentes = new Map((tipo === 'grupo' ? grupos.todos() : fontes.todos()).map((x) => [nomeComparavel(x.nome), x]));
  const naLista = new Set<string>();
  const codigosNaLista = new Map<string, string>();
  const cadastrados = (tipo === 'grupo' ? grupos.todos() : fontes.todos()) as { id: string; nome: string; ativo: boolean; codigo_conta: string | null }[];
  const resultado: LinhaCadastroLote[] = [];

  texto.split(/\r?\n/).forEach((bruta, i) => {
    const [nomeBruto = '', a = '', b = '', c = ''] = bruta.split(/\t|;/).map((x) => x.trim());
    const nome = limpar(nomeBruto);
    if (!nome) return;
    const chave = nomeComparavel(nome);
    // Linha de cabeçalho copiada junto.
    if (['nome', 'grupo', 'grupos', 'fonte', 'fontes', 'grupo de gasto', 'fonte de recurso'].includes(chave) && i === 0) return;

    const linha: LinhaCadastroLote = {
      linha: i + 1,
      nome,
      situacao: 'ok',
      problema: null,
    };
    const existente = existentes.get(chave);
    if (existente) {
      linha.situacao = 'ja_existe';
      linha.problema = existente.ativo ? 'Já cadastrado: será ignorado.' : 'Existe entre os excluídos: reative em vez de cadastrar.';
    } else if (naLista.has(chave)) {
      linha.situacao = 'ja_existe';
      linha.problema = 'Repetido na lista: será ignorado.';
    } else if (tipo === 'grupo') {
      const rh = lerRh(a);
      if (rh === null)
        Object.assign(linha, {
          situacao: 'erro',
          problema: `Tipo "${a}" não reconhecido. Use RH ou deixe vazio.`,
        });
      else linha.rh = rh;
    } else {
      const natureza = lerNatureza(a);
      const uso = lerUso(b);
      if (!a)
        Object.assign(linha, {
          situacao: 'erro',
          problema: 'Falta a natureza (pública ou própria).',
        });
      else if (!natureza)
        Object.assign(linha, {
          situacao: 'erro',
          problema: `Natureza "${a}" não reconhecida. Use pública ou própria.`,
        });
      else if (!b)
        Object.assign(linha, {
          situacao: 'erro',
          problema: 'Falta o uso (livre ou restrito).',
        });
      else if (!uso)
        Object.assign(linha, {
          situacao: 'erro',
          problema: `Uso "${b}" não reconhecido. Use livre ou restrito.`,
        });
      else Object.assign(linha, { natureza, uso });
    }
    if (linha.situacao === 'ok') {
      const bruto = tipo === 'grupo' ? b : c;
      try {
        const codigo = limparCodigoConta(bruto);
        const dono = acharCodigoRepetido(cadastrados, codigo);
        const colega = codigo ? codigosNaLista.get(chaveCodigoConta(codigo)) : undefined;
        if (dono) Object.assign(linha, { situacao: 'erro', problema: `O código ${codigo} já é d${tipo === 'grupo' ? 'o grupo' : 'a fonte'} "${dono.nome}".` });
        else if (colega) Object.assign(linha, { situacao: 'erro', problema: `O código ${codigo} está repetido na lista (também em "${colega}").` });
        else {
          linha.codigo_conta = codigo;
          if (codigo) codigosNaLista.set(chaveCodigoConta(codigo), nome);
        }
      } catch (e) {
        if (!(e instanceof ErroCodigoConta)) throw e;
        Object.assign(linha, { situacao: 'erro', problema: e.message });
      }
    }
    naLista.add(chave);
    resultado.push(linha);
  });
  return resultado;
}

/** Cadastra as linhas prontas, conferindo tudo de novo. Devolve quantos foram cadastrados. */
export async function cadastrarEmLote(p: Planilhas, quem: Autorizador, tipo: TipoCadastro, linhas: LinhaCadastroLote[]): Promise<number> {
  exigir(quem);
  const texto = linhas
    .filter((l) => l.situacao === 'ok')
    .map((l) => (tipo === 'grupo' ? `${l.nome};${l.rh ? 'RH' : ''};${l.codigo_conta ?? ''}` : `${l.nome};${l.natureza ?? ''};${l.uso ?? ''};${l.codigo_conta ?? ''}`))
    .join('\n');
  const conferidas = (await analisarCadastrosEmLote(p, quem, tipo, texto)).filter((l) => l.situacao === 'ok');
  if (conferidas.length === 0) throw new ErroValidacaoFolha('Nenhum item pronto para cadastrar. Confira a lista de novo.');
  const [grupos, fontes] = await lerTabelas(p, [GruposGasto, Fontes] as const);
  const autoria = { email: quem.email };
  if (tipo === 'grupo') {
    await inserirRegistros(
      p,
      grupos,
      conferidas.map((l) => ({ nome: l.nome, rh: Boolean(l.rh), codigo_conta: l.codigo_conta ?? null })),
      autoria,
    );
  } else {
    await inserirRegistros(
      p,
      fontes,
      conferidas.map((l) => ({
        nome: l.nome,
        natureza: l.natureza!,
        uso: l.uso!,
        codigo_conta: l.codigo_conta ?? null,
      })),
      autoria,
    );
  }
  await registrarAuditoria(p, {
    usuario: quem.email,
    acao: 'inclusao',
    entidade: tipo === 'grupo' ? 'GruposGasto' : 'Fontes',
    detalhes: { emLote: conferidas.length },
  });
  return conferidas.length;
}
