import type { Metadata } from 'next';
import { PaginaDeLista } from '../visao';

export const metadata: Metadata = { title: 'Para aprovar' };

export default function Pagina() {
  return (
    <PaginaDeLista
      visao="aprovar"
      titulo="Para aprovar"
      descricao="Requisições dos centros de custo da sua coordenação (e, para a Diretoria, as que ela aprova). Abra a ficha para aprovar, devolver ou recusar."
      vazio="Nada para aprovar."
    />
  );
}
