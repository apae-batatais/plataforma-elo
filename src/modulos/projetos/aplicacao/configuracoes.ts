/** Configurações do app Projetos: limite de alçada, pareceres exigidos, designados e conflito de interesse. */
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { ErroPermissao } from '@/nucleo/acesso/autorizador';
import { atualizar, inserir, lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { ConfigProjetos } from '../dados/tabelas';
import { ErroProjetos, PAPEIS_DESIGNADOS, PORTES, TIPOS_PARECER, type ConfigProjetos as Config } from '../dominio/projeto';
import { auditar, autoriaDe, CHAVES_CONFIG, configDeLinhas, type Opcoes } from './comum';

/** Configuração e a versão de cada linha (para o formulário detectar gravação de outra pessoa). */
export async function lerConfigComVersoes(p: Planilhas): Promise<{ config: Config; versoes: Record<string, number> }> {
  const [linhas] = await lerTabelas(p, [ConfigProjetos] as const);
  const ativas = linhas.ativos();
  return { config: configDeLinhas(ativas), versoes: Object.fromEntries(ativas.map((l) => [l.chave, l.versao])) };
}

function paraLinhas(c: Config): Record<(typeof CHAVES_CONFIG)[number], string> {
  return {
    limite_alcada: c.limiteAlcada === null ? '' : String(c.limiteAlcada),
    pareceres_completo: c.pareceresPorta1.completo.join(','),
    pareceres_enxuto: c.pareceresPorta1.enxuto.join(','),
    proponente_decide: c.proponenteDecide ? 'sim' : 'nao',
    tol_custo_linha: String(c.tolerancias.custoLinhaPct),
    tol_custo_total: String(c.tolerancias.custoTotalPct),
    tol_prazo_fim: String(c.tolerancias.prazoFimDias),
    tol_prazo_marco: String(c.tolerancias.prazoMarcoDias),
    ...(Object.fromEntries(PAPEIS_DESIGNADOS.map((papel) => [`designados_${papel}`, c.designados[papel].join(',')])) as Record<string, string>),
  } as Record<(typeof CHAVES_CONFIG)[number], string>;
}

/** Só a Diretoria (`projetos.configurar`) altera. `versoes` é o que a pessoa viu na tela, por chave. */
export async function salvarConfig(p: Planilhas, quem: Autorizador, nova: Config, opcoes: Opcoes & { versoes?: Record<string, number> } = {}): Promise<void> {
  if (!quem.temPermissao('projetos.configurar')) throw new ErroPermissao();
  if (nova.limiteAlcada !== null && (!Number.isFinite(nova.limiteAlcada) || nova.limiteAlcada < 0)) throw new ErroProjetos('O limite de alçada precisa ser um valor igual ou maior que zero.');
  for (const porte of PORTES) {
    for (const t of nova.pareceresPorta1[porte]) if (!TIPOS_PARECER.includes(t)) throw new ErroProjetos('Tipo de parecer desconhecido.');
  }
  for (const n of Object.values(nova.tolerancias)) if (!Number.isFinite(n) || n < 0) throw new ErroProjetos('As tolerâncias precisam ser zero ou maiores.');
  const agora = opcoes.agora ?? new Date();
  const [linhas] = await lerTabelas(p, [ConfigProjetos] as const);
  const valores = paraLinhas(nova);
  for (const chave of CHAVES_CONFIG) {
    const atual = linhas.ativos().find((l) => l.chave === chave);
    const valor = valores[chave];
    if (!atual) {
      const novo = await inserir(p, ConfigProjetos, { chave, valor: valor || null }, autoriaDe(quem, agora));
      await auditar(p, quem, 'inclusao', 'ConfigProjetos', novo.id, ['chave', 'valor'], agora);
      continue;
    }
    if ((atual.valor ?? '') === valor) continue;
    const versao = opcoes.versoes?.[chave] ?? atual.versao;
    const { colunasAlteradas } = await atualizar(p, ConfigProjetos, atual.id, versao, { valor: valor || null }, autoriaDe(quem, agora));
    await auditar(p, quem, 'alteracao', 'ConfigProjetos', atual.id, colunasAlteradas, agora);
  }
}
