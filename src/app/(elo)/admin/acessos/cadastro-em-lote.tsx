'use client';

/**
 * Cadastro de várias pessoas de uma vez: cola a lista, confere a prévia, confirma.
 */
import { useActionState } from 'react';
import type { LinhaUsuarioLote } from '@/nucleo/acesso/gestao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { estiloEntrada } from '@/ui/campo';
import { Etiqueta } from '@/ui/pagina';

type Estado = { erro?: string; linhas?: LinhaUsuarioLote[]; texto?: string };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

const EXEMPLO = 'Maria da Silva\tmaria.silva@instituicao.org.br\nJoão Souza\tjoao.souza@instituicao.org.br\tCoordenação de serviço\tEducação';

const ETIQUETA: Record<LinhaUsuarioLote['situacao'], { texto: string; tipo: 'sucesso' | 'info' | 'neutro' | 'erro' }> = {
  novo: { texto: 'Acesso novo', tipo: 'sucesso' },
  perfil: { texto: 'Só o perfil', tipo: 'info' },
  reativar: { texto: 'Reativar', tipo: 'info' },
  ja_existe: { texto: 'Ignorado', tipo: 'neutro' },
  erro: { texto: 'Corrigir', tipo: 'erro' },
};

export function CadastroDeUsuariosEmLote({ conferir, cadastrar, dominio }: { conferir: Acao; cadastrar: Acao; dominio: string | null }) {
  const [previa, enviarLista, conferindo] = useActionState(conferir, {});
  const [final, confirmar, gravando] = useActionState(cadastrar, {});
  const linhas = previa.linhas ?? [];
  const prontas = linhas.filter((l) => l.situacao === 'novo' || l.situacao === 'perfil' || l.situacao === 'reativar');
  const erros = linhas.filter((l) => l.situacao === 'erro');
  const ignoradas = linhas.filter((l) => l.situacao === 'ja_existe');

  return (
    <div className="space-y-5">
      <form action={enviarLista} className="space-y-3">
        <label className="block text-sm">
          <span className="font-semibold">Cole a lista</span>
          <span className="mt-0.5 block text-texto-suave">
            Uma linha por pessoa, nesta ordem: <strong>Nome</strong>, <strong>E-mail</strong>, Perfil (opcional, padrão <strong>Funcionário</strong>) e Vale
            para (opcional: unidade, área ou serviço; vazio = toda a instituição). Pode copiar direto da planilha ou separar com ponto e vírgula.
            {dominio && <> Os e-mails precisam terminar em @{dominio}.</>}
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
          <input type="hidden" name="linhas" value={JSON.stringify(prontas)} />
          <p className="text-sm">
            <strong>{prontas.length}</strong> {prontas.length === 1 ? 'pessoa pronta' : 'pessoas prontas'}
            {erros.length > 0 && (
              <>
                , <strong className="text-erro">{erros.length}</strong> com problema
              </>
            )}
            {ignoradas.length > 0 && (
              <>
                , {ignoradas.length} {ignoradas.length === 1 ? 'ignorada' : 'ignoradas'}
              </>
            )}
            .
          </p>
          <div className="max-h-96 overflow-auto rounded-lg border border-borda">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-superficie-2 text-texto-suave">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Pessoa
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Perfil
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Vale para
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
                    <td className="px-3 py-2">
                      <span className="font-semibold">{l.nome || '—'}</span>
                      <span className="block text-xs text-texto-suave">{l.email || 'sem e-mail'}</span>
                    </td>
                    <td className="px-3 py-2">{l.perfilNome ?? '—'}</td>
                    <td className="px-3 py-2">{l.escopoNome}</td>
                    <td className="px-3 py-2">
                      <Etiqueta tipo={ETIQUETA[l.situacao].tipo}>{ETIQUETA[l.situacao].texto}</Etiqueta>
                      {l.problema && <span className="mt-1 block text-xs">{l.problema}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {erros.length > 0 && (
            <p className="text-sm text-texto-suave">
              As linhas com problema não serão cadastradas. Corrija-as na lista acima e clique em “Conferir a lista” de novo, ou cadastre só as que estão
              prontas.
            </p>
          )}
          <BotaoEnviar pendente={gravando} disabled={prontas.length === 0} enviando="Cadastrando…">
            Cadastrar {prontas.length} {prontas.length === 1 ? 'pessoa' : 'pessoas'}
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
