/** Lista de projetos e ideias: código, título, tipo, porte, valor, responsável e etapa. */
import Link from 'next/link';
import { TabelaDados } from '@/ui/tabela-dados';
import type { LinhaProjeto } from '../aplicacao/ideias';
import { NOME_ETAPA, NOME_PORTE, NOME_TIPO } from '../dominio/projeto';
import { EtiquetaEtapa, moeda } from './rotulos';

export function ListaProjetos({ linhas, legenda, vazio }: { linhas: LinhaProjeto[]; legenda: string; vazio: string }) {
  return (
    <TabelaDados
      legenda={legenda}
      vazio={vazio}
      colunas={[
        { chave: 'codigo', rotulo: 'Código' },
        { chave: 'titulo', rotulo: 'Título' },
        { chave: 'tipo', rotulo: 'Tipo', secundaria: true },
        { chave: 'porte', rotulo: 'Porte', secundaria: true },
        { chave: 'valor', rotulo: 'Valor estimado' },
        { chave: 'responsavel', rotulo: 'Responsável' },
        { chave: 'etapa', rotulo: 'Etapa' },
      ]}
      linhas={linhas.map((r) => ({
        id: r.id,
        valores: { codigo: r.codigo, titulo: r.titulo, tipo: NOME_TIPO[r.tipo], porte: NOME_PORTE[r.porte], valor: moeda(r.valorEstimado), responsavel: r.responsavel ?? 'Sem responsável', etapa: NOME_ETAPA[r.etapa] },
        celulas: {
          codigo: (
            <Link href={`/projetos/${r.id}`} className="font-semibold text-destaque hover:underline">
              {r.codigo}
            </Link>
          ),
          etapa: <EtiquetaEtapa etapa={r.etapa} />,
        },
      }))}
    />
  );
}
