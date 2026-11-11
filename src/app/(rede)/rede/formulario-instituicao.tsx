'use client';

/**
 * Cadastro (ou alteração) de uma instituição da rede. Em caso de erro, a
 * mensagem aparece aqui e nada do que foi digitado se perde.
 */
import { useActionState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { ENDERECO_DO_ARQUIVO } from '@/nucleo/armazenamento/pastas';
import type { LinhaInstituicao } from '@/nucleo/rede/rede';

type Estado = { erro?: string; valores?: Record<string, string> };
type Acao = (estado: Estado, f: FormData) => Promise<Estado>;

export function FormularioInstituicao({
  acao,
  planilhas,
  instituicao,
}: {
  acao: Acao;
  planilhas: { chave: string; nome: string; obrigatoria: boolean }[];
  instituicao?: LinhaInstituicao;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const i = instituicao;
  // Depois de um erro, os campos voltam com o que foi digitado.
  const v = (campo: string, original?: string) => estado.valores?.[campo] ?? original;
  return (
    <form action={enviar} className="space-y-5">
      {i && (
        <>
          <input type="hidden" name="id" value={i.id} />
          <input type="hidden" name="versao" value={i.versao} />
        </>
      )}
      <fieldset className="space-y-3">
        <legend className="font-semibold">Instituição</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Nome curto" obrigatorio dica="Como aparece no Elo (ex.: Instituição Exemplo).">
            <input name="nome" required defaultValue={v('nome', i?.nome)} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Código" obrigatorio dica={i ? 'Não muda depois do cadastro.' : 'Minúsculas, sem espaço (ex.: instituicao-exemplo).'}>
            <input
              name="codigo"
              required
              defaultValue={v('codigo', i?.codigo)}
              readOnly={!!i}
              pattern="[a-z0-9_-]{2,40}"
              className={`${estiloEntrada} ${i ? 'bg-superficie-2 text-texto-suave' : ''}`}
            />
          </Campo>
        </div>
        <Campo rotulo="Razão social">
          <input name="nomeCompleto" defaultValue={v('nomeCompleto', i?.nomeCompleto !== i?.nome ? i?.nomeCompleto : '')} className={estiloEntrada} />
        </Campo>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Acesso</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Domínio dos e-mails" obrigatorio dica="Só e-mails desse domínio entram (ex.: instituicao.org.br).">
            <input name="dominio" required defaultValue={v('dominio', i?.dominio)} placeholder="instituicao.org.br" className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Endereços de acesso" dica="Um por linha, sem https:// (ex.: elo.instituicao.org.br).">
            <textarea name="enderecos" rows={2} defaultValue={v('enderecos', i?.enderecos.join('\n'))} className={estiloEntrada} />
          </Campo>
        </div>
        <Campo
          rotulo="Administradores iniciais"
          dica="E-mails do domínio da instituição, um por linha. Entram mesmo com as planilhas em branco, para rodar Preparar estrutura."
        >
          <textarea
            name="administradoresIniciais"
            rows={2}
            defaultValue={v('administradoresIniciais', i?.administradoresIniciais.join('\n'))}
            className={estiloEntrada}
          />
        </Campo>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="font-semibold">Pasta no Drive da instituição</legend>
        <p className="text-sm text-texto-suave">
          A instituição cria um Drive compartilhado, inclui a conta de serviço do Elo como <strong>Gerente de conteúdo</strong> e envia o link da pasta. Cole-o
          aqui: ao salvar, o Elo confere a pasta e cria sozinho as planilhas, a pasta de anexos e as abas.
        </p>
        <input type="hidden" name="pasta_anterior" value={i?.pasta ?? ''} />
        <Campo rotulo="Link da pasta" obrigatorio={!i || !!i.pasta || !i.planilhas.nucleo} dica="Pode colar o link copiado do Drive ou só o ID da pasta.">
          <input
            name="pasta"
            required={!i || !!i.pasta || !i.planilhas.nucleo}
            defaultValue={v('pasta', i?.pasta)}
            placeholder="https://drive.google.com/drive/folders/…"
            className={`${estiloEntrada} font-mono text-xs`}
          />
        </Campo>
        {i && (
          <ul className="space-y-1.5 text-sm" aria-label="Planilhas do Elo nesta instituição">
            {planilhas.map((p) => {
              const id = i.planilhas[p.chave];
              return (
                <li key={p.chave} className="flex flex-wrap items-center gap-2">
                  <span aria-hidden="true" className={id ? 'text-sucesso' : 'text-texto-suave'}>
                    {id ? '✓' : '○'}
                  </span>
                  <span>
                    {p.nome}: {id ? 'criada' : 'será criada ao preparar a estrutura'}
                  </span>
                  {id && (
                    <a
                      href={ENDERECO_DO_ARQUIVO(id, p.chave === 'anexos' ? 'pasta' : 'planilha')}
                      target="_blank"
                      rel="noreferrer"
                      className="text-destaque hover:underline"
                    >
                      Abrir
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <Campo
        rotulo="Unidades iniciais"
        dica="Uma por linha, no formato codigo=Nome (ex.: sede=Sede). Usadas só quando a aba de unidades está vazia."
      >
        <textarea
          name="unidades"
          rows={2}
          defaultValue={v('unidades', i?.unidades.map((u) => `${u.codigo}=${u.nome}`).join('\n'))}
          className={`${estiloEntrada} font-mono text-xs`}
        />
      </Campo>

      {estado.erro && (
        <Aviso tipo="erro" titulo="A instituição não foi salva">
          {estado.erro}
        </Aviso>
      )}
      <BotaoEnviar enviando="Salvando…" className="w-full">
        {i ? 'Salvar alterações' : 'Cadastrar instituição'}
      </BotaoEnviar>
    </form>
  );
}
