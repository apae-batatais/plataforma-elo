import type { Metadata } from 'next';
import { LinkBotao, pequeno } from '@/ui/botao';
import { IconeMais } from '@/ui/icones';
import { PaginaDeLista } from './visao';

export const metadata: Metadata = { title: 'Minhas requisições' };

export default function MinhasRequisicoes() {
  return (
    <PaginaDeLista
      visao="minhas"
      titulo="Minhas requisições"
      descricao="Os pedidos que você fez e em que etapa cada um está. Clique no número para ver a ficha e o histórico."
      vazio="Você ainda não fez nenhuma requisição. Use “Nova requisição”."
      acoes={
        <LinkBotao href="/requisicoes/nova" className={pequeno}>
          <IconeMais tamanho={16} /> Nova requisição
        </LinkBotao>
      }
    />
  );
}
