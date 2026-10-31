'use client';

/**
 * Grupos de gasto ou fontes de recurso de uma vez: cola, confere a prévia, confirma.
 */
import { useActionState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { Etiqueta } from '@/ui/pagina';
import type { LinhaCadastroLote, TipoCadastro } from '../aplicacao/cadastros-em-lote';
import { NATUREZA, USO } from '../dominio/previsao';

type Estado = { erro?: string; linhas?: LinhaCadastroLote[]; texto?: string };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

const TEXTOS = {
  grupo: {
    instrucao: (
      <>
        Uma linha por grupo: <strong>Nome</strong> e, se for de Recursos Humanos (fora da folha), escreva <strong>RH</strong> na coluna ao lado.
      </>
    ),
    exemplo: 'Material de consumo\nServiços de terceiros\nRPA\tRH',
    singular: 'grupo',
    plural: 'grupos',
  },
  fonte: {
    instrucao: (
      <>
        Uma linha por fonte, nesta ordem: <strong>Nome</strong>, <strong>Natureza</strong> (pública ou própria) e <strong>Uso</strong> (livre ou restrito).
      </>
    ),
    exemplo: 'Subvenção municipal\tpública\trestrito\nDoações\tprópria\tlivre',
    singular: 'fonte',
    plural: 'fontes',
  },
} as const;

export function CadastroEmLoteOrcamento({ tipo, conferir, cadastrar }: { tipo: TipoCadastro; conferir: Acao; cadastrar: Acao }) {
  const [previa, enviarLista, conferindo] = useActionState(conferir, {});
  const [final, confirmar, gravando] = useActionState(cadastrar, {});
  const t = TEXTOS[tipo];
  const linhas = previa.linhas ?? [];
  const ok = linhas.filter((l) => l.situacao === 'ok');
  const erros = linhas.filter((l) => l.situacao === 'erro');
  const ignorados = linhas.filter((l) => l.situacao === 'ja_existe');
  const nome = (n: number) => `${n} ${n === 1 ? t.singular : t.plural}`;

  return (
    <div className="space-y-5">
      <form action={enviarLista} className="space-y-3">
        <label className="block text-sm">
          <span className="font-semibold">Cole a lista</span>
          <span className="mt-0.5 block text-texto-suave">
            {t.instrucao} Pode copiar direto da planilha (colunas lado a lado) ou separar com ponto e vírgula.
          </span>
          <textarea
            name="lista"
            rows={8}
            defaultValue={previa.texto}
            placeholder={t.exemplo}
            spellCheck={false}
            className={`${estiloEntrada} font-mono text-sm`}
          />
        </label>
        <BotaoEnviar pendente={conferindo} variante="secundario" enviando="Conferindo…">
          Conferir a lista
        </BotaoEnviar>
        {previa.erro && <Aviso tipo="erro">{previa.erro}</Aviso>}
      </form>

      {linhas.length > 0 && (
        <form action={confirmar} className="space-y-4">
          <input type="hidden" name="linhas" value={JSON.stringify(ok)} />
          <p className="text-sm">
            <strong>{ok.length}</strong> {ok.length === 1 ? 'pronto' : 'prontos'} para cadastrar
            {erros.length > 0 && (
              <>
                , <strong className="text-erro">{erros.length}</strong> com problema
              </>
            )}
            {ignorados.length > 0 && (
              <>
                , {ignorados.length} {ignorados.length === 1 ? 'ignorado' : 'ignorados'}
              </>
            )}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Nome
                  </th>
                  {tipo === 'grupo' ? (
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Tipo
                    </th>
                  ) : (
                    <>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Natureza
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Uso
                      </th>
                    </>
                  )}
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Situação
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr
                    key={l.linha}
                    className={`border-t border-borda ${l.situacao === 'erro' ? 'bg-erro-fundo/50' : l.situacao === 'ja_existe' ? 'text-texto-suave' : ''}`}
                  >
                    <td className="px-3 py-2 font-semibold">{l.nome}</td>
                    {tipo === 'grupo' ? (
                      <td className="px-3 py-2">{l.situacao === 'ok' ? (l.rh ? 'Recursos Humanos' : 'Despesa geral') : '—'}</td>
                    ) : (
                      <>
                        <td className="px-3 py-2">{l.natureza ? NATUREZA[l.natureza] : '—'}</td>
                        <td className="px-3 py-2">{l.uso ? USO[l.uso] : '—'}</td>
                      </>
                    )}
                    <td className="px-3 py-2">
                      {l.situacao === 'ok' ? (
                        <Etiqueta tipo="sucesso">Pronto</Etiqueta>
                      ) : (
                        <span className="text-xs">
                          <Etiqueta tipo={l.situacao === 'erro' ? 'erro' : 'neutro'}>{l.situacao === 'erro' ? 'Corrigir' : 'Ignorado'}</Etiqueta>
                          <span className="mt-1 block">{l.problema}</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {erros.length > 0 && (
            <p className="text-sm text-texto-suave">
              As linhas com problema não serão cadastradas. Corrija-as na lista acima e clique em “Conferir a lista” de novo, ou cadastre só as prontas.
            </p>
          )}
          <BotaoEnviar pendente={gravando} disabled={ok.length === 0} enviando="Cadastrando…">
            Cadastrar {nome(ok.length)}
          </BotaoEnviar>
          {final.erro && (
            <Aviso tipo="erro" titulo="Nada foi cadastrado">
              {final.erro}
            </Aviso>
          )}
        </form>
      )}
    </div>
  );
}
