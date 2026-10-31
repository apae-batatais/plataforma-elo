import type { Metadata } from 'next';
import { PaginaDeLista } from '../visao';

export const metadata: Metadata = { title: 'Todas as requisições' };

export default function Pagina() {
  return <PaginaDeLista visao="todas" titulo="Todas as requisições" descricao="Todas as requisições da instituição, com a situação e o prazo de cada etapa." vazio="Nenhuma requisição ainda." />;
}
