import Link from 'next/link';
import { Aviso } from '@/ui/aviso';
import { textoDeDias } from '../dominio/cedidos';
import type { AvisosDeCessao } from '../aplicacao/cedidos';
import { data } from './formato';

/** Faixa "Cessões perto do fim": só aparece se houver. Vencida vem primeiro, com texto e ícone (nunca só cor). */
export function FaixaCessoes({ avisos }: { avisos: AvisosDeCessao }) {
  if (avisos.itens.length === 0) return null;
  const n = avisos.itens.length;
  const vencidas = avisos.itens.filter((i) => i.vencida).length;
  return (
    <div className="mb-6">
      <Aviso tipo="atencao" titulo={`${n} ${n === 1 ? 'cessão termina' : 'cessões terminam'} em até ${avisos.avisoDias} dias${vencidas ? ` (${vencidas} já ${vencidas === 1 ? 'venceu' : 'venceram'})` : ''}`}>
        <ul className="mt-1 space-y-1">
          {avisos.itens.map((i) => (
            <li key={i.id}>
              <strong>{i.vencida ? 'Vencida: ' : ''}</strong>
              {i.colaborador ? `${i.colaborador}, ` : ''}
              {i.funcao}
              {i.servicos.length ? ` · ${i.servicos.join(', ')}` : ''} · fim em {data(i.fimPrevisto)} ({textoDeDias(i.dias)})
              {avisos.verNome && (
                <>
                  {' '}
                  <Link href={`/orcamento/cedidos/${i.id}`} className="font-semibold text-destaque hover:underline">
                    {avisos.podeEditar ? 'Prorrogar ou encerrar' : 'Abrir ficha'}
                  </Link>
                </>
              )}
            </li>
          ))}
        </ul>
        {!avisos.verNome && <p className="mt-2">Fale com o Departamento Pessoal para prorrogar ou encerrar.</p>}
      </Aviso>
    </div>
  );
}
