import type { Metadata } from 'next';
import { PaginaDeLista } from '../visao';

export const metadata: Metadata = { title: 'Para atender' };

export default function Pagina() {
  return (
    <PaginaDeLista
      visao="atender"
      titulo="Para atender"
      descricao="Requisições aprovadas dos tipos do seu setor. Abra a ficha para receber e, depois, concluir o atendimento."
      vazio="Nenhuma requisição na fila do seu setor."
    />
  );
}
