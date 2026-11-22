import Link from 'next/link';

const ABAS = [
  { chave: 'resumo', rotulo: 'Resumo e fase atual', parte: '' },
  { chave: 'marco', rotulo: 'Marco lógico', parte: '/marco-logico' },
  { chave: 'riscos', rotulo: 'Riscos', parte: '/riscos' },
  { chave: 'atividades', rotulo: 'Atividades', parte: '/atividades' },
  { chave: 'orcamento', rotulo: 'Orçamento', parte: '/orcamento' },
  { chave: 'equipe', rotulo: 'Equipe', parte: '/equipe' },
  { chave: 'ligacoes', rotulo: 'Ligações', parte: '/ligacoes' },
] as const;

/** Seções do projeto. No celular a lista rola de lado, sem esconder nenhuma. */
export function AbasProjeto({ id, atual }: { id: string; atual: (typeof ABAS)[number]['chave'] }) {
  return (
    <nav aria-label="Seções do projeto" className="-mx-1 overflow-x-auto">
      <ul className="flex gap-2 px-1 pb-1">
        {ABAS.map((a) => (
          <li key={a.chave}>
            <Link
              href={`/projetos/${id}${a.parte}`}
              aria-current={a.chave === atual ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-md border px-3 text-sm font-semibold ${a.chave === atual ? 'border-texto bg-superficie-2' : 'border-borda hover:bg-superficie-2'}`}
            >
              {a.rotulo}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
