'use client';

/**
 * Formulário "Cadastrar pessoa". Em caso de erro continua aberto com o que foi digitado,
 * a mensagem acima dos campos e, se já existir cadastro parecido, as saídas possíveis.
 */
import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { acaoCadastrarPessoa, type EstadoCadastro } from './acoes';
import { CamposPessoa } from './campos-pessoa';

export function FormularioCadastro({
  servicos,
  papeis,
}: {
  servicos: { codigo: string; nome: string }[];
  papeis: { valor: string; rotulo: string }[];
}) {
  const [estado, enviar] = useActionState<EstadoCadastro, FormData>(acaoCadastrarPessoa, {});
  const v = estado.valores ?? {};
  const [servico, setServico] = useState(v.servico ?? '');
  const [papel, setPapel] = useState(v.papel ?? 'atendido');
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={enviar} className="space-y-4">
      {estado.erro && (
        <Aviso tipo={estado.duplicidade?.tipo === 'nome' ? 'atencao' : 'erro'} titulo={estado.duplicidade ? 'Esta pessoa já pode estar cadastrada' : 'Confira os dados'}>
          {estado.erro}
          {estado.duplicidade?.existenteId && (
            <>
              {' '}
              <Link href={`/nucleo/pessoas?abrir=${estado.duplicidade.existenteId}`} className="font-semibold underline">
                Vincular a pessoa que já existe
              </Link>
            </>
          )}
        </Aviso>
      )}
      <CamposPessoa
        valor={{ nome: v.nome, nomeSocial: v.nomeSocial, dataNascimento: v.dataNascimento, cpf: v.cpf, nis: v.nis, email: v.email, telefone: v.telefone, cidade: v.cidade, bairro: v.bairro }}
        maisDadosAberto={Boolean(v.cpf || v.nis || v.email || v.telefone || v.cidade || v.bairro)}
      />
      <Campo rotulo="Papel">
        <select name="papel" value={papel} onChange={(e) => setPapel(e.target.value)} className={estiloEntrada}>
          {papeis.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </Campo>
      <Campo rotulo="Serviço" dica={papel === 'atendido' && !servico ? 'Sem serviço, a pessoa não aparece para avaliar.' : undefined}>
        {servicos.length === 0 ? (
          <p className="mt-1.5 text-sm text-texto-suave">Você ainda não tem serviço no seu escopo. Peça à administração. O cadastro sem serviço continua possível.</p>
        ) : (
          <select name="servico" value={servico} onChange={(e) => setServico(e.target.value)} className={estiloEntrada}>
            <option value="">Sem serviço por enquanto</option>
            {servicos.map((s) => (
              <option key={s.codigo} value={s.codigo}>
                {s.nome}
              </option>
            ))}
          </select>
        )}
      </Campo>
      {servico && (
        <Campo rotulo="Entrada" dica="Pode ser uma data passada, para quem já é atendido.">
          <input name="entrada" type="date" max={hoje} defaultValue={v.entrada || hoje} className={estiloEntrada} />
        </Campo>
      )}
      <div className="flex flex-wrap gap-2">
        <BotaoEnviar enviando="Salvando…" className="flex-1">
          {servico ? 'Cadastrar e vincular' : 'Cadastrar pessoa'}
        </BotaoEnviar>
        {estado.duplicidade?.tipo === 'nome' && (
          <BotaoEnviar variante="secundario" name="confirmarOutraPessoa" value="1" enviando="Salvando…">
            É outra pessoa, cadastrar
          </BotaoEnviar>
        )}
      </div>
    </form>
  );
}
