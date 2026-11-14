/**
 * Ícones de traço (24×24), desenhados aqui para não depender de biblioteca.
 * Decorativos por padrão (aria-hidden); o texto ao lado dá o sentido.
 */
import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & { tamanho?: number };

function Icone({ tamanho = 20, children, ...resto }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  );
}

export const IconeInicio = (p: Props) => (
  <Icone {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
  </Icone>
);
export const IconePessoas = (p: Props) => (
  <Icone {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c1.9.7 3.2 2.4 3.5 5.2" />
  </Icone>
);
export const IconeOrcamento = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 13h3M8 16.5h3M14.5 13h2M14.5 16.5h2" />
  </Icone>
);
export const IconeRequisicao = (p: Props) => (
  <Icone {...p}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3" />
  </Icone>
);
/** Avaliação de Serviços Sociais: ficha com a linha de um indicador. */
export const IconeAvaliacao = (p: Props) => (
  <Icone {...p}>
    <rect x="4" y="4" width="16" height="17" rx="2" />
    <path d="M9 4V3h6v1M7 14h2.5l1.5-3 2 5 1.5-2H17" />
  </Icone>
);
export const IconeComunicacao = (p: Props) => (
  <Icone {...p}>
    <path d="M3 10v4a1 1 0 0 0 1 1h3l9 5V4L7 9H4a1 1 0 0 0-1 1Z" />
    <path d="M7 15l1.5 5h2.5l-1.2-4.2M19.5 9.5a4 4 0 0 1 0 5" />
  </Icone>
);
export const IconeChave = (p: Props) => (
  <Icone {...p}>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 8.7-8.7M16.5 6.5l2.5 2.5M14 9l2 2" />
  </Icone>
);
export const IconeServicos = (p: Props) => (
  <Icone {...p}>
    <path d="M4 21V8l8-5 8 5v13" />
    <path d="M9 21v-6h6v6M9 10.5h.01M15 10.5h.01" />
  </Icone>
);
export const IconeAreas = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </Icone>
);
export const IconePlanilha = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M3 9h18M3 15h18M9 3v18" />
  </Icone>
);
export const IconeMenu = (p: Props) => (
  <Icone {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icone>
);
export const IconeFechar = (p: Props) => (
  <Icone {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icone>
);
export const IconeMais = (p: Props) => (
  <Icone {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icone>
);
export const IconeSair = (p: Props) => (
  <Icone {...p}>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Icone>
);
export const IconeAjuda = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2h.01" />
  </Icone>
);
export const IconeCerto = (p: Props) => (
  <Icone {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icone>
);
export const IconeAtencao = (p: Props) => (
  <Icone {...p}>
    <path d="M12 3.5 2.5 20h19L12 3.5Z" />
    <path d="M12 10v4.5M12 17.5h.01" />
  </Icone>
);
export const IconeInfo = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.5h.01" />
  </Icone>
);
export const IconeErro = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Icone>
);
export const IconeSeta = (p: Props) => (
  <Icone {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icone>
);
export const IconeEditar = (p: Props) => (
  <Icone {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
  </Icone>
);
export const IconeReativar = (p: Props) => (
  <Icone {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4" />
  </Icone>
);
export const IconeMaisOpcoes = (p: Props) => (
  <Icone {...p}>
    <path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} />
  </Icone>
);
export const IconeLixeira = (p: Props) => (
  <Icone {...p}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Icone>
);
export const IconeEnviar = (p: Props) => (
  <Icone {...p}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  </Icone>
);
export const IconeBusca = (p: Props) => (
  <Icone {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Icone>
);
/** Agenda: calendário com uma data marcada. */
export const IconeAgenda = (p: Props) => (
  <Icone {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <circle cx="12" cy="15" r="1.6" />
  </Icone>
);
export const IconeDividir = (p: Props) => (
  <Icone {...p}>
    <path d="M4 12h16M12 4v16" />
  </Icone>
);
export const IconeSol = (p: Props) => (
  <Icone {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icone>
);
export const IconeLua = (p: Props) => (
  <Icone {...p}>
    <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
  </Icone>
);
export const IconeComputador = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Icone>
);
export const IconeRecolher = (p: Props) => (
  <Icone {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15.5 10 13.5 12l2 2" />
  </Icone>
);

/** Parcerias: dois elos que se encontram. */
export const IconeParcerias = (p: Props) => (
  <Icone {...p}>
    <rect x="2.5" y="8" width="12" height="8" rx="4" />
    <rect x="9.5" y="8" width="12" height="8" rx="4" />
  </Icone>
);
/** Projetos: bandeira sobre um caminho com marcos (as portas de decisão). */
export const IconeProjetos = (p: Props) => (
  <Icone {...p}>
    <path d="M6 3v10" />
    <path d="M6 4h9l-1.8 3L15 10H6" />
    <circle cx="5" cy="20" r="1.5" />
    <circle cx="12" cy="17" r="1.5" />
    <circle cx="19" cy="20" r="1.5" />
    <path d="M6.5 19.5 10.7 17.6M13.3 17.6l4.2 1.9" />
  </Icone>
);

/** Ícones que o menu e a tela inicial usam pelo nome (um lugar só para a escolha). */
export const ICONES = {
  inicio: IconeInicio,
  agenda: IconeAgenda,
  busca: IconeBusca,
  pessoas: IconePessoas,
  orcamento: IconeOrcamento,
  requisicoes: IconeRequisicao,
  comunicacao: IconeComunicacao,
  avaliacao: IconeAvaliacao,
  parcerias: IconeParcerias,
  projetos: IconeProjetos,
  acessos: IconeChave,
  servicos: IconeServicos,
  areas: IconeAreas,
  planilhas: IconePlanilha,
  ajuda: IconeAjuda,
} as const;

export type NomeIcone = keyof typeof ICONES;
