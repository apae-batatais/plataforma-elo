import { Aviso } from '@/ui/aviso';
import { formatarValor } from '@/ui/formato';
import { BarrasAgrupadas } from '@/ui/graficos';
import { NumeroQueConta } from '@/ui/numero-que-conta';
import { Secao } from '@/ui/pagina';
import { leituraDoResultado } from '../dominio/evento';
import type { ResultadoDoEvento } from '../aplicacao/resultado-evento';

const moeda = (v: number) => formatarValor(v, 'moeda');

/** Frase de conclusão da comparação: o título do gráfico (L19). */
function conclusao(r: ResultadoDoEvento): string {
  const { anterior, variacao } = r.comparacao;
  if (!anterior || variacao === null) return 'Comparação com as edições anteriores';
  if (variacao > 0) return `O resultado de ${r.rotulo} passou o de ${anterior.rotulo} em ${moeda(variacao)}`;
  if (variacao < 0) return `O resultado de ${r.rotulo} ficou ${moeda(-variacao)} abaixo do de ${anterior.rotulo}`;
  return `O resultado de ${r.rotulo} ficou igual ao de ${anterior.rotulo}`;
}

/** Cartão "Resultado do evento" (tela 4): resultado em número grande, receita e custo ao lado e comparação com a série. */
export function ResultadoDoEventoCartao({ r }: { r: ResultadoDoEvento }) {
  if (!r.aplica) return null;
  const descricao = r.parcial ? 'Números de agora, ainda sem o encerramento. Mudam enquanto o Financeiro lança o realizado.' : 'Números fotografados ao encerrar o evento.';
  if (r.estado === 'sem_permissao') {
    return (
      <Secao id="t-resultado" titulo="Resultado do evento" descricao={descricao}>
        <Aviso tipo="info">O Financeiro e a Diretoria veem os valores.</Aviso>
      </Secao>
    );
  }
  if (r.estado === 'indisponivel') {
    return (
      <Secao id="t-resultado" titulo="Resultado do evento" descricao={descricao}>
        <Aviso tipo="info">Ligação indisponível: o Orçamento não está ativo ou não respondeu.</Aviso>
      </Secao>
    );
  }
  if (r.lancamentos === 0) {
    return (
      <Secao id="t-resultado" titulo="Resultado do evento" descricao={descricao}>
        <Aviso tipo="atencao" titulo="Sem lançamentos no Orçamento">
          O Orçamento ainda não tem lançamentos com este projeto. Peça ao Financeiro para informar o realizado com o campo Projeto.
        </Aviso>
      </Secao>
    );
  }
  const { palavra, valor } = leituraDoResultado(r.resultado);
  const texto = palavra === 'Ficou no zero' ? palavra : `${palavra} ${moeda(valor)}`;
  const { melhor, anterior } = r.comparacao;
  const categorias = [...r.anteriores.map((e) => e.rotulo), r.parcial ? `${r.rotulo} (parcial)` : r.rotulo];
  return (
    <Secao id="t-resultado" titulo="Resultado do evento" descricao={descricao}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
        <p className="text-3xl font-bold tabular-nums" aria-label={`Resultado do evento: ${texto}`}>
          <NumeroQueConta texto={texto} />
        </p>
        <dl className="flex gap-6 text-sm">
          <div><dt className="text-texto-suave">Receita</dt><dd className="font-medium tabular-nums">{moeda(r.receita)}</dd></div>
          <div><dt className="text-texto-suave">Custo</dt><dd className="font-medium tabular-nums">{moeda(r.custo)}</dd></div>
        </dl>
      </div>
      {r.parcial && (
        <div className="mt-3">
          <Aviso tipo="info">Edição em andamento: o resultado é parcial e fica fora da comparação até o encerramento.</Aviso>
        </div>
      )}
      <div className="mt-5">
        {!r.serie ? (
          <p className="text-sm text-texto-suave">Evento único: não há série para comparar.</p>
        ) : !anterior ? (
          <p className="text-sm text-texto-suave">Primeira edição da série: ainda não há com o que comparar.</p>
        ) : (
          <div>
            <h3 className="mb-3 font-semibold">{conclusao(r)}</h3>
            <BarrasAgrupadas
              categorias={categorias}
              series={[
                { nome: 'Receita', valores: [...r.anteriores.map((e) => e.receita), r.receita], cor: 1 },
                { nome: 'Custo', valores: [...r.anteriores.map((e) => e.custo), r.custo], cor: 2 },
              ]}
              formato="moeda"
              rotuloCategoria="Edição"
              descricao={`Receita e custo de cada edição da série ${r.serie}, da mais antiga à edição atual.`}
            />
            {melhor && <p className="mt-2 text-sm text-texto-suave">Edição com melhor resultado: {melhor.rotulo} ({moeda(melhor.resultado)}).</p>}
          </div>
        )}
      </div>
    </Secao>
  );
}
