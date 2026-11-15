import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { lerFase } from '@/modulos/projetos/aplicacao/fases';
import { GRAUS, NOME_GRAU } from '@/modulos/projetos/dominio/fases';
import { AbasProjeto } from '@/modulos/projetos/telas/abas-projeto';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { FormularioConfirmado } from '@/ui/confirmar';
import { CabecalhoPagina, EstadoVazio, Etiqueta, Secao } from '@/ui/pagina';
import { acaoEncerrarRisco, acaoRegistrarRisco } from '../../acoes';

export const metadata: Metadata = { title: 'Riscos do projeto' };

export default async function PaginaRiscos({ params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const { id } = await params;
  const { planilhas } = await obterAplicacao();
  const f = await lerFase(planilhas, usuario.autorizador, id);
  if (!f) notFound();
  const editavel = f.podeAlterar && (f.fase === 1 || f.fase === 2);
  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Projetos', href: '/projetos' }, { rotulo: f.projeto.codigo, href: `/projetos/${id}` }, { rotulo: 'Riscos' }]}
        titulo="Riscos"
        descricao="O que pode dar errado, o quanto pesa e o que fazer a respeito."
      />
      <AbasProjeto id={id} atual="riscos" />
      {!editavel && <Aviso tipo="info">Só quem gerencia o projeto altera os riscos, e só nas fases 1 e 2. Você vê o conteúdo em leitura.</Aviso>}
      {f.riscos.length === 0 ? (
        <EstadoVazio titulo="Nada aqui ainda.">{editavel ? 'Registre ao menos um risco: o porte completo exige isso para abrir a porta 2.' : 'Nenhum risco registrado.'}</EstadoVazio>
      ) : (
        <Secao id="t-lista" titulo="Riscos registrados">
          <ul className="divide-y divide-borda">
            {f.riscos.map((x) => (
              <li key={x.id} className="space-y-1 py-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {x.descricao}
                  <Etiqueta tipo={x.situacao === 'aberto' ? 'atencao' : 'neutro'}>{x.situacao === 'aberto' ? 'Aberto' : 'Encerrado'}</Etiqueta>
                </p>
                <p>Probabilidade: {NOME_GRAU[x.probabilidade]} · Impacto: {NOME_GRAU[x.impacto]}</p>
                {x.resposta && <p>O que fazer: {x.resposta}</p>}
                {x.dono && <p className="text-texto-suave">Dono: {x.dono}</p>}
                {editavel && x.situacao === 'aberto' && (
                  <FormularioConfirmado acao={acaoEncerrarRisco} campos={{ id, risco: x.id, versao_risco: x.versao }} rotulo="Encerrar risco" titulo="Encerrar este risco?" mensagem="O risco continua guardado, mas deixa de contar como aberto." confirmar="Encerrar risco" pequeno />
                )}
              </li>
            ))}
          </ul>
        </Secao>
      )}
      {editavel && (
        <Secao id="t-novo" titulo="Registrar risco">
          <form action={acaoRegistrarRisco} className="space-y-4">
            <input type="hidden" name="id" value={id} />
            <Campo rotulo="O que pode dar errado" obrigatorio>
              <textarea name="descricao" required rows={2} className={estiloEntrada} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              {(['probabilidade', 'impacto'] as const).map((campo) => (
                <Campo key={campo} rotulo={campo === 'probabilidade' ? 'Probabilidade' : 'Impacto'} obrigatorio>
                  <select name={campo} required defaultValue="" className={estiloEntrada}>
                    <option value="" disabled>Escolha</option>
                    {GRAUS.map((g) => <option key={g} value={g}>{NOME_GRAU[g]}</option>)}
                  </select>
                </Campo>
              ))}
            </div>
            <Campo rotulo="O que fazer a respeito" dica="ex.: reservar folga de duas semanas no prazo.">
              <input name="resposta" className={estiloEntrada} />
            </Campo>
            <Campo rotulo="Dono do risco (e-mail)" dica="Quem acompanha este risco.">
              <input type="email" name="dono" className={estiloEntrada} />
            </Campo>
            <BotaoEnviar enviando="Salvando…">Registrar risco</BotaoEnviar>
          </form>
        </Secao>
      )}
    </div>
  );
}
