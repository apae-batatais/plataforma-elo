/**
 * Avaliações FICTÍCIAS da demonstração: pessoas inventadas nos serviços de exemplo
 * da Assistência Social, umas só com a avaliação inicial, outras também com o
 * acompanhamento anual, e algumas com a reavaliação atrasada ou vencendo.
 * Gravadas pelos próprios casos de uso.
 * O sorteio usa semente fixa: a demonstração mostra sempre os mesmos números.
 */
import { Autorizador } from '@/nucleo/acesso/autorizador';
import { lerTabelas, type Planilhas } from '@/nucleo/armazenamento/tabela';
import { Atribuicoes, PerfilPermissoes, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { salvarAvaliacao } from '../aplicacao/avaliacoes';
import { CUIDADORES, SEM_CUIDADOR, type DadosAvaliacao } from '../dominio/avaliacao';

/** Gerador simples com semente (mulberry32). */
function sorteador(semente: number) {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const um = <T>(lista: readonly T[], pesos?: number[]): T => {
    if (!pesos) return lista[Math.floor(r() * lista.length)];
    const total = pesos.reduce((s, p) => s + p, 0);
    let x = r() * total;
    for (let i = 0; i < lista.length; i++) if ((x -= pesos[i]) < 0) return lista[i];
    return lista[lista.length - 1];
  };
  return { r, um, sim: (p: number) => (r() < p ? 'Sim' : 'Não') as 'Sim' | 'Não' };
}

const SERVICOS = [
  { codigo: 'ur', pessoas: 20, idade: [18, 59] as const, iii: 0.35 },
  { codigo: 'centro_dia_intergeracional', pessoas: 10, idade: [60, 88] as const, iii: 0.25 },
  { codigo: 'servico_domicilio', pessoas: 6, idade: [30, 85] as const, iii: 0.6 },
];
const LETRAS = 'ABCDEFGIJLMNOPRSTV';

export async function popularAvaliacoesFicticias(p: Planilhas): Promise<void> {
  const [usuarios, atribuicoes, perfilPermissoes, servicos] = await lerTabelas(p, [Usuarios, Atribuicoes, PerfilPermissoes, Servicos] as const);
  const existentes = new Set(servicos.ativos().map((s) => s.codigo));
  const diretoria = new Autorizador('diretoria@exemplo.local', {
    usuarios: usuarios.ativos(),
    atribuicoes: atribuicoes.ativos(),
    perfilPermissoes: perfilPermissoes.ativos(),
    servicos: servicos.todos(),
  });
  const s = sorteador(2027);
  const agora = new Date('2026-11-05T15:00:00Z');
  let dia = 0;
  for (const sv of SERVICOS.filter((x) => existentes.has(x.codigo))) {
    for (let i = 0; i < sv.pessoas; i++) {
      const idade = sv.idade[0] + Math.floor(s.r() * (sv.idade[1] - sv.idade[0] + 1));
      const dd = String(1 + (dia++ % 28)).padStart(2, '0');
      const nasc = `${2026 - idade - 1}-${String(1 + Math.floor(s.r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(s.r() * 28)).padStart(2, '0')}`;
      const grau = s.um(['I', 'II', 'III'] as const, [0.12, 0.88 - sv.iii, sv.iii]);
      const ostomia = s.sim(grau === 'III' ? 0.15 : 0.03);
      const barreiras = (['sobrecarga', 'sem_apoio', 'violencia_psicologica', 'rendimentos', 'abandono'] as const).filter(
        (_, k) => s.r() < [0.7, 0.45, 0.05, 0.04, 0.03][k],
      );
      const atual: Partial<DadosAvaliacao> = {
        iniciais: Array.from({ length: 2 + Math.floor(s.r() * 2) }, () => s.um(LETRAS.split(''))).join(''),
        nascimento: nasc,
        sexo: s.um(['F', 'M'] as const),
        servico: sv.codigo,
        data_avaliacao: `2026-10-${dd}`,
        tipo: 'Inicial',
        evolucao_usuario: s.um(['Regrediu', 'Manteve', 'Melhorou'] as const, [0.3, 0.58, 0.12]),
        evolucao_familia: s.um(['Regrediu', 'Manteve', 'Melhorou'] as const, [0.34, 0.62, 0.04]),
        cuidador: s.r() < 0.05 ? SEM_CUIDADOR : s.um(CUIDADORES.slice(0, 8)),
        bpc: s.sim(0.5),
        mae_solo: s.sim(0.3),
        rede_apoio: s.sim(0.58),
        cuidador_idoso: s.sim(sv.codigo === 'centro_dia_intergeracional' ? 0.6 : 0.4),
        nucleo_mais_pcd: s.sim(0.14),
        adultos_30: s.sim(0.8),
        isolamento: s.sim(0.52),
        enfermagem: s.sim(grau === 'III' ? 0.5 : 0.15),
        grau_deficiencia: s.um(['Leve', 'Moderada', 'Grave', 'Não se aplica'] as const, [0.1, 0.42, 0.2, 0.28]),
        grau_dependencia: grau,
        ostomia,
        ostomia_tipo: ostomia === 'Sim' ? s.um(['Gastrostomia', 'Traqueostomia', 'Sonda']) : '',
        transporte: s.um(['Comum', 'Rampa', 'Cadeirante'] as const, grau === 'III' ? [0.3, 0.3, 0.4] : [0.65, 0.2, 0.15]),
        barreiras: barreiras.length ? [...barreiras] : ['nenhuma'],
        profissional: 'Assistente social (fictícia)',
      };
      const cenario = s.r();
      if (cenario < 0.45) {
        // Já tinha a avaliação inicial em 2025: a de 2026 é o acompanhamento anual.
        const antes = s.um(['pior', 'melhor', 'igual'] as const, [0.55, 0.25, 0.2]);
        const inicial: Partial<DadosAvaliacao> = {
          ...atual,
          tipo: 'Inicial',
          data_avaliacao: `2025-10-${dd}`,
          evolucao_usuario: 'Manteve',
          evolucao_familia: 'Manteve',
        };
        if (antes === 'pior') {
          Object.assign(inicial, {
            isolamento: 'Sim',
            rede_apoio: 'Não',
            barreiras: [...new Set([...(atual.barreiras ?? []).filter((b) => b !== 'nenhuma'), 'sobrecarga', 'sem_apoio'])],
          });
          if (s.r() < 0.4 && atual.grau_dependencia !== 'III') inicial.grau_dependencia = atual.grau_dependencia === 'I' ? 'II' : 'III';
        } else if (antes === 'melhor') {
          Object.assign(inicial, { isolamento: 'Não', rede_apoio: 'Sim', barreiras: ['nenhuma'] });
        }
        await salvarAvaliacao(p, diretoria, inicial, { agora });
        await salvarAvaliacao(p, diretoria, { ...atual, tipo: 'Acompanhamento anual' }, { agora });
      } else if (cenario < 0.53) {
        // Avaliada em 2025 e ainda sem o acompanhamento anual: reavaliação atrasada.
        await salvarAvaliacao(p, diretoria, { ...atual, data_avaliacao: `2025-10-${dd}` }, { agora });
      } else if (cenario < 0.58) {
        // Avaliada em novembro de 2025: o acompanhamento vence em breve.
        await salvarAvaliacao(p, diretoria, { ...atual, data_avaliacao: `2025-11-${String(20 + (dia % 8)).padStart(2, '0')}` }, { agora });
      } else {
        await salvarAvaliacao(p, diretoria, atual, { agora });
      }
    }
  }
}
