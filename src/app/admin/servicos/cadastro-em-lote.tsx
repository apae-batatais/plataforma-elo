'use client';

/**
 * Cadastro de vários serviços de uma vez: cola, confere a prévia, confirma.
 */
import { useActionState } from 'react';
import type { LinhaServicoLote } from '@/nucleo/acesso/gestao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { Etiqueta } from '@/ui/pagina';

type Estado = { erro?: string; linhas?: LinhaServicoLote[]; texto?: string };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

const EXEMPLO = 'Centro Dia Intergeracional\tAssistência Social\tSede\t80\nViveiro de mudas\tRural\tFilial';

export function CadastroEmLote({ conferir, cadastrar }: { conferir: Acao; cadastrar: Acao }) {
  const [previa, enviarLista, conferindo] = useActionState(conferir, {});
  const [final, confirmar, gravando] = useActionState(cadastrar, {});
  const linhas = previa.linhas ?? [];
  const ok = linhas.filter((l) => l.situacao === 'ok');
  const erros = linhas.filter((l) => l.situacao === 'erro');
  const ignorados = linhas.filter((l) => l.situacao === 'ja_existe');

  return (
    <div className="space-y-5">
      <form action={enviarLista} className="space-y-3">
        <label className="block text-sm">
          <span className="font-semibold">Cole a lista</span>
          <span className="mt-0.5 block text-texto-suave">
            Uma linha por serviço, nesta ordem: <strong>Nome</strong>, <strong>Área</strong>, Unidade (opcional, padrão Sede) e Vagas (opcional).
            Pode copiar direto da planilha (colunas lado a lado) ou separar com ponto e vírgula.
          </span>
          <textarea
            name="lista"
            rows={8}
            defaultValue={previa.texto}
            placeholder={EXEMPLO}
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
            <strong>{ok.length}</strong> {ok.length === 1 ? 'serviço pronto' : 'serviços prontos'} para cadastrar
            {erros.length > 0 && (
              <>
                , <strong className="text-erro">{erros.length}</strong> com problema
              </>
            )}
            {ignorados.length > 0 && <>, {ignorados.length} já {ignorados.length === 1 ? 'existe' : 'existem'}</>}.
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Serviço</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Área</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Unidade</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Vagas</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.linha} className={`border-t border-borda ${l.situacao === 'erro' ? 'bg-erro-fundo/50' : l.situacao === 'ja_existe' ? 'text-texto-suave' : ''}`}>
                    <td className="px-3 py-2">
                      <span className="font-semibold">{l.nome}</span>
                      {l.codigo && <span className="block text-xs text-texto-suave">Código: {l.codigo}</span>}
                    </td>
                    <td className="px-3 py-2">{l.areaNome ?? '—'}</td>
                    <td className="px-3 py-2">{l.unidadeNome ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.vagas ?? ''}</td>
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
              As linhas com problema não serão cadastradas. Corrija-as na lista acima e clique em “Conferir a lista” de novo, ou cadastre só as que estão prontas.
            </p>
          )}
          <BotaoEnviar pendente={gravando} disabled={ok.length === 0} enviando="Cadastrando…">
            Cadastrar {ok.length} {ok.length === 1 ? 'serviço' : 'serviços'}
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
