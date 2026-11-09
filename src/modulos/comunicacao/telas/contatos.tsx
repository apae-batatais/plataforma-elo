/** Telas dos contatos da imprensa e dos grupos de envio. Recebem dados e ações prontos (a rota decide de onde vêm). */
import Link from 'next/link';
import { estiloBotao } from '@/ui/botao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { Etiqueta } from '@/ui/pagina';

type Acao = (f: FormData) => void | Promise<void>;

export interface ContatoDaTela {
  id: string;
  versao: number;
  ativo: boolean;
  nome: string;
  veiculo: string | null;
  email: string;
  grupos: string[];
}
export interface GrupoDaTela {
  id: string;
  versao: number;
  ativo: boolean;
  nome: string;
  contatos: number;
}

export function FormularioContato({ acao, grupos, valor, rotuloBotao }: { acao: Acao; grupos: GrupoDaTela[]; valor?: ContatoDaTela; rotuloBotao: string }) {
  return (
    <form action={acao} className="space-y-4">
      {valor && (
        <>
          <input type="hidden" name="id" value={valor.id} />
          <input type="hidden" name="versao" value={valor.versao} />
        </>
      )}
      <Campo rotulo="Nome" obrigatorio>
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="Veículo" dica="Opcional. Ex.: nome do jornal ou da rádio.">
        <input name="veiculo" defaultValue={valor?.veiculo ?? ''} className={estiloEntrada} />
      </Campo>
      <Campo rotulo="E-mail" obrigatorio>
        <input name="email" type="email" required defaultValue={valor?.email} className={estiloEntrada} />
      </Campo>
      <fieldset>
        <legend className="text-sm font-semibold">Grupos</legend>
        {grupos.length === 0 ? (
          <p className="mt-0.5 text-sm text-texto-suave">Ainda não há grupos ativos. Crie um grupo primeiro.</p>
        ) : (
          <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
            {grupos.map((g) => (
              <label key={g.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-borda px-3 py-2 text-sm">
                <input type="checkbox" name="grupos" value={g.id} defaultChecked={valor?.grupos.includes(g.id) ?? false} />
                {g.nome}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <BotaoEnviar enviando="Salvando…" className="w-full">
        {rotuloBotao}
      </BotaoEnviar>
    </form>
  );
}

export function FormularioGrupo({ acao, valor, rotuloBotao }: { acao: Acao; valor?: GrupoDaTela; rotuloBotao: string }) {
  return (
    <form action={acao} className="space-y-4">
      {valor && (
        <>
          <input type="hidden" name="id" value={valor.id} />
          <input type="hidden" name="versao" value={valor.versao} />
        </>
      )}
      <Campo rotulo="Nome do grupo" obrigatorio dica="Ex.: Jornais e rádios da cidade.">
        <input name="nome" required defaultValue={valor?.nome} className={estiloEntrada} />
      </Campo>
      <BotaoEnviar enviando="Salvando…" className="w-full">
        {rotuloBotao}
      </BotaoEnviar>
    </form>
  );
}

const vazio = (texto: string) => <p className="rounded-cartao border border-borda bg-superficie px-5 py-4 text-sm text-texto-suave">{texto}</p>;

export function ListaGrupos({ grupos, desativar, reativar }: { grupos: GrupoDaTela[]; desativar: Acao; reativar: Acao }) {
  if (grupos.length === 0) return vazio('Nenhum grupo ainda. Use “Adicionar grupo”.');
  return (
    <ul className="space-y-3" aria-label="Grupos de envio">
      {grupos.map((g) => (
        <li key={g.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-cartao border border-borda bg-superficie p-4 ${g.ativo ? '' : 'opacity-80'}`}>
          <div>
            <p className="font-semibold">{g.nome}</p>
            <p className="text-sm text-texto-suave">
              {g.contatos} {g.contatos === 1 ? 'contato ativo' : 'contatos ativos'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!g.ativo && <Etiqueta>Desativado</Etiqueta>}
            <Link href={`/comunicacao/contatos?grupo=${g.id}`} className={estiloBotao('secundario', '!min-h-11')}>
              Alterar
            </Link>
            <FormularioConfirmado
              acao={g.ativo ? desativar : reativar}
              campos={{ id: g.id, versao: g.versao }}
              rotulo={g.ativo ? 'Desativar' : 'Reativar'}
              variante="fantasma"
              perigoso={g.ativo}
              titulo={g.ativo ? `Desativar “${g.nome}”?` : `Reativar “${g.nome}”?`}
              mensagem={
                g.ativo
                  ? 'O grupo deixa de aparecer para escolha nos próximos agendamentos. Os contatos continuam cadastrados e você pode reativar depois.'
                  : 'O grupo volta a aparecer para escolha nos agendamentos.'
              }
              confirmar={g.ativo ? 'Desativar' : 'Reativar'}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ListaContatos({
  contatos,
  nomesDosGrupos,
  desativar,
  reativar,
}: {
  contatos: ContatoDaTela[];
  nomesDosGrupos: Record<string, string>;
  desativar: Acao;
  reativar: Acao;
}) {
  if (contatos.length === 0) return vazio('Nenhum contato ainda. Use “Adicionar contato”.');
  return (
    <ul className="space-y-3" aria-label="Contatos da imprensa">
      {contatos.map((c) => (
        <li key={c.id} className={`rounded-cartao border border-borda bg-superficie p-4 ${c.ativo ? '' : 'opacity-80'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{c.nome}</p>
              <p className="text-sm text-texto-suave">{[c.veiculo, c.email].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!c.ativo && <Etiqueta>Desativado</Etiqueta>}
              <Link href={`/comunicacao/contatos?contato=${c.id}`} className={estiloBotao('secundario', '!min-h-11')}>
                Alterar
              </Link>
              <FormularioConfirmado
                acao={c.ativo ? desativar : reativar}
                campos={{ id: c.id, versao: c.versao }}
                rotulo={c.ativo ? 'Desativar' : 'Reativar'}
                variante="fantasma"
                perigoso={c.ativo}
                titulo={c.ativo ? `Desativar “${c.nome}”?` : `Reativar “${c.nome}”?`}
                mensagem={
                  c.ativo
                    ? 'O contato deixa de receber os e-mails prontos. Ele continua guardado e você pode reativar depois.'
                    : 'O contato volta a receber os e-mails prontos.'
                }
                confirmar={c.ativo ? 'Desativar' : 'Reativar'}
              />
            </div>
          </div>
          {c.grupos.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {c.grupos.map((g) => (
                <Etiqueta key={g} tipo="info">
                  {nomesDosGrupos[g] ?? 'Grupo'}
                </Etiqueta>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
