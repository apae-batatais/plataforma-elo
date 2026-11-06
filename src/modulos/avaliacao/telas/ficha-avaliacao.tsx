/**
 * Ficha de uma avaliação para imprimir (cabe numa folha A4): identificação,
 * todas as respostas, barreiras marcadas, índice com os fatores e campo de assinatura.
 */
import type { ReactNode } from 'react';
import {
  BARREIRAS,
  DEFINICAO_GRAU,
  fatoresDoIndice,
  geracao,
  idadeEm,
  INDICE_MAXIMO,
  NENHUMA_BARREIRA,
  temViolacao,
  type DadosAvaliacao,
} from '../dominio/avaliacao';

const br = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-1.5 border-b border-borda pb-0.5 text-[13px] font-bold text-destaque">{titulo}</h2>
      {children}
    </section>
  );
}

function Itens({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
      {itens.map(([r, v]) => (
        <div key={r} className="contents">
          <dt className="text-texto-suave">{r}</dt>
          <dd className="font-semibold">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

const Marca = ({ marcado }: { marcado: boolean }) => (
  <span
    aria-hidden="true"
    className={`inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border text-[9px] font-bold leading-none ${marcado ? 'border-destaque bg-destaque text-sobre-destaque' : 'border-texto-suave'}`}
  >
    {marcado ? '✓' : ''}
  </span>
);

export function FichaAvaliacao({ d, servicoNome }: { d: DadosAvaliacao; servicoNome: string }) {
  const idade = idadeEm(d.nascimento, d.data_avaliacao);
  const fatores = fatoresDoIndice(d);
  const indice = fatores.reduce((s, f) => s + f.pontos, 0);
  const nenhuma = d.barreiras.includes(NENHUMA_BARREIRA);
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg bg-superficie-2 px-4 py-3 break-inside-avoid sm:grid-cols-4">
        {(
          [
            ['Iniciais', d.iniciais],
            ['Nascimento', br(d.nascimento)],
            ['Idade', idade === null ? '—' : `${idade} anos · ${geracao(idade).toLowerCase()}`],
            ['Sexo', d.sexo === 'F' ? 'Feminino' : 'Masculino'],
            ['Prontuário', d.prontuario || '—'],
            ['Serviço atual', servicoNome],
            ['Data da avaliação', br(d.data_avaliacao)],
          ] as const
        ).map(([r, v]) => (
          <div key={r} className={r === 'Serviço atual' ? 'col-span-2' : ''}>
            <p className="text-[11px] text-texto-suave">{r}</p>
            <p className="font-bold">{v}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
        <Bloco titulo="Evolução desde a avaliação anterior">
          <Itens
            itens={[
              ['Pessoa atendida', d.evolucao_usuario],
              ['Família', d.evolucao_familia],
            ]}
          />
        </Bloco>
        <Bloco titulo="Deficiência e dependência">
          <Itens
            itens={[
              ['Grau de deficiência', d.grau_deficiencia],
              ['Grau de dependência', `Grau ${d.grau_dependencia}`],
              ['Ostomia ou dispositivo', d.ostomia === 'Sim' ? `Sim · ${d.ostomia_tipo}` : 'Não'],
              ['Apoio de enfermagem', d.enfermagem],
            ]}
          />
          {d.grau_dependencia && <p className="mt-1 text-[11px] text-texto-suave">RDC Anvisa 502/2021 · {DEFINICAO_GRAU[d.grau_dependencia]}</p>}
        </Bloco>
        <Bloco titulo="Família e cuidado">
          <Itens
            itens={[
              ['Principal cuidador', d.cuidador],
              ['Cuidador idoso (60+)', d.cuidador_idoso],
              ['Mãe solo', d.mae_solo],
              ['Rede de apoio', d.rede_apoio],
              ['Mais de 1 PcD no núcleo', d.nucleo_mais_pcd],
              ['Adultos acima de 30 anos', d.adultos_30],
            ]}
          />
        </Bloco>
        <Bloco titulo="Proteção social e convivência">
          <Itens
            itens={[
              ['Recebe BPC', d.bpc],
              ['Isolamento social', d.isolamento],
              ['Transporte', d.transporte === 'Rampa' ? 'Com rampa' : d.transporte],
            ]}
          />
        </Bloco>
      </div>

      <Bloco titulo="Barreiras identificadas">
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
          {BARREIRAS.map((b) => (
            <li key={b.codigo} className="flex items-center gap-2">
              <Marca marcado={d.barreiras.includes(b.codigo)} /> {b.nome}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <Marca marcado={nenhuma} /> Nenhum dos itens
          </li>
        </ul>
        {temViolacao(d.barreiras) && (
          <p className="mt-2 rounded border-l-4 border-erro bg-erro-fundo px-2 py-1 text-[12px] font-semibold">
            Suspeita de violação de direitos: seguir o fluxo de notificação da unidade e o encaminhamento ao CREAS, e registrar as providências.
          </p>
        )}
      </Bloco>

      <section className="flex items-center gap-4 rounded-lg border border-borda px-4 py-2.5 break-inside-avoid">
        <p className="shrink-0">
          <span className="block text-[11px] text-texto-suave">Índice de necessidade de cuidado</span>
          <span className="text-2xl font-bold text-destaque tabular-nums">{indice}</span>
          <span className="text-texto-suave"> de {INDICE_MAXIMO}</span>
        </p>
        <p className="text-[12px] text-texto-suave">
          {fatores.length ? fatores.map((f) => (f.pontos > 1 ? `${f.nome} (+${f.pontos})` : f.nome)).join(' · ') : 'Nenhum indicador presente.'}
          <span className="mt-0.5 block text-[11px]">
            Grau de dependência II = 1 e III = 2; cada indicador presente soma 1. Apoia a análise técnica, não a substitui.
          </span>
        </p>
      </section>

      <Bloco titulo="Registro técnico">
        <p className="min-h-[3.2em] whitespace-pre-wrap">{d.observacoes || <span className="text-texto-suave">Sem observações.</span>}</p>
      </Bloco>

      <section className="grid grid-cols-2 gap-10 pt-6 break-inside-avoid">
        <div className="border-t border-texto pt-1 text-[12px]">
          <p className="font-semibold">{d.profissional || 'Profissional responsável'}</p>
          <p className="text-texto-suave">{d.registro_profissional ? `Registro ${d.registro_profissional}` : 'Nome e registro profissional'}</p>
        </div>
        <div className="border-t border-texto pt-1 text-[12px]">
          <p className="font-semibold">Assinatura</p>
          <p className="text-texto-suave">Data: ____/____/________</p>
        </div>
      </section>
    </div>
  );
}
