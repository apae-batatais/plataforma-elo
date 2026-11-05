'use client';

/**
 * Cadastro (ou alteração) de uma instituição da rede. Em caso de erro, a
 * mensagem aparece aqui e nada do que foi digitado se perde.
 */
import { useActionState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
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
          <Campo rotulo="Nome curto" obrigatorio dica="Como aparece no Elo (ex.: Apae Franca).">
            <input name="nome" required defaultValue={v('nome', i?.nome)} className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Código" obrigatorio dica={i ? 'Não muda depois do cadastro.' : 'Minúsculas, sem espaço (ex.: apae-franca).'}>
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
          <Campo rotulo="Domínio dos e-mails" obrigatorio dica="Só e-mails desse domínio entram (ex.: apaefranca.org.br).">
            <input name="dominio" required defaultValue={v('dominio', i?.dominio)} placeholder="apaefranca.org.br" className={estiloEntrada} />
          </Campo>
          <Campo rotulo="Endereços de acesso" dica="Um por linha, sem https:// (ex.: elo.apaefranca.org.br).">
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
        <legend className="font-semibold">Planilhas no Drive da instituição</legend>
        <p className="text-sm text-texto-suave">
          Cole o ID de cada planilha: o trecho do link entre <code>/d/</code> e <code>/edit</code>. Cada planilha deve estar compartilhada com a conta de
          serviço do Elo.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {planilhas.map((p) => (
            <Campo key={p.chave} rotulo={p.nome} obrigatorio={p.obrigatoria}>
              <input
                name={`planilha_${p.chave}`}
                required={p.obrigatoria}
                defaultValue={v(`planilha_${p.chave}`, i?.planilhas[p.chave])}
                className={`${estiloEntrada} font-mono text-xs`}
              />
            </Campo>
          ))}
        </div>
        <Campo
          rotulo="Pasta de anexos (fotos e vídeos)"
          dica="Opcional. Uma pasta numa unidade compartilhada do Drive da instituição, com a conta de serviço como Gerente de conteúdo. Cole o trecho do link depois de /folders/. Sem ela, as requisições não aceitam foto nem vídeo."
        >
          <input name="pasta_anexos" defaultValue={v('pasta_anexos', i?.planilhas.anexos)} className={`${estiloEntrada} font-mono text-xs`} />
        </Campo>
      </fieldset>

      <Campo
        rotulo="Unidades iniciais"
        dica="Uma por linha, no formato codigo=Nome (ex.: sede=Apae Franca (Sede)). Usadas só quando a aba de unidades está vazia."
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
