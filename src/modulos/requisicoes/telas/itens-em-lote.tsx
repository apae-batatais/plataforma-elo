'use client';

/**
 * Itens aceitos por um tipo, de uma vez: cola a lista da planilha, confere e confirma.
 */
import { useActionState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { Etiqueta } from '@/ui/pagina';
import type { LinhaItemLote } from '../aplicacao/requisicoes';

type Estado = { erro?: string; linhas?: LinhaItemLote[]; texto?: string };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

export function ItensEmLote({ tipo, conferir, cadastrar }: { tipo: string; conferir: Acao; cadastrar: Acao }) {
  const [previa, enviarLista, conferindo] = useActionState(conferir, {});
  const [final, confirmar, gravando] = useActionState(cadastrar, {});
  const linhas = previa.linhas ?? [];
  const ok = linhas.filter((l) => l.situacao === 'ok');
  const erros = linhas.filter((l) => l.situacao === 'erro');
  const ignorados = linhas.length - ok.length - erros.length;

  return (
    <div className="space-y-5">
      <form action={enviarLista} className="space-y-3">
        <input type="hidden" name="tipo" value={tipo} />
        <label className="block text-sm">
          <span className="font-semibold">Cole a lista</span>
          <span className="mt-0.5 block text-texto-suave">
            Uma linha por item: <strong>Descrição</strong> e <strong>Unidade</strong> (un, kg, L, pacote…). Pode copiar direto da planilha (colunas lado a lado)
            ou separar com ponto e vírgula.
          </span>
          <textarea
            name="lista"
            rows={8}
            defaultValue={previa.texto}
            placeholder={'Detergente neutro 500 ml\tfrasco\nPapel toalha\tpacote\nÁlcool 70%;L'}
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
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="linhas" value={JSON.stringify(ok)} />
          <p className="text-sm">
            <strong>{ok.length}</strong> {ok.length === 1 ? 'pronto' : 'prontos'} para incluir
            {erros.length > 0 && (
              <>
                , <strong className="text-erro">{erros.length}</strong> com problema
              </>
            )}
            {ignorados > 0 && (
              <>
                , {ignorados} {ignorados === 1 ? 'ignorado' : 'ignorados'}
              </>
            )}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Unidade
                  </th>
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
                    <td className="px-3 py-2 font-semibold">{l.descricao}</td>
                    <td className="px-3 py-2">{l.unidade || '—'}</td>
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
          <BotaoEnviar pendente={gravando} disabled={ok.length === 0} enviando="Incluindo…">
            Incluir {ok.length} {ok.length === 1 ? 'item' : 'itens'}
          </BotaoEnviar>
          {final.erro && (
            <Aviso tipo="erro" titulo="Nada foi incluído">
              {final.erro}
            </Aviso>
          )}
        </form>
      )}
    </div>
  );
}
