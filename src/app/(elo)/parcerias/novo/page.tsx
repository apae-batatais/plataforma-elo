import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Servicos } from '@/nucleo/estrutura/tabelas';
import { lerTabela } from '@/nucleo/armazenamento/tabela';
import { NOME_TIPO } from '@/modulos/parcerias/dominio/termos';
import { CamposFonte } from '@/modulos/parcerias/telas/campos-fonte';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { Aviso } from '@/ui/aviso';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { Campo, estiloEntrada } from '@/ui/campo';
import { CabecalhoPagina, Secao } from '@/ui/pagina';
import { acaoCriarTermo } from '../acoes';

export const metadata: Metadata = { title: 'Novo termo' };

export default async function NovoTermo({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (!usuario.autorizador.temPermissao('parcerias.termos.editar')) redirect('/parcerias');
  const { planilhas } = await obterAplicacao();
  const servicos = (await lerTabela(planilhas, Servicos)).todos();
  const { erro } = await searchParams;
  return (
    <div className="max-w-3xl space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Parcerias', href: '/parcerias' }, { rotulo: 'Novo termo' }]}
        titulo="Novo termo"
        descricao="Cadastre o termo com um serviço e uma fonte. Outras fontes e aportes entram depois, na ficha do termo."
      />
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <form action={acaoCriarTermo} className="space-y-6">
        <Secao titulo="Dados do termo">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Parceiro" obrigatorio>
                <input name="parceiro" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Número do termo" obrigatorio>
                <input name="numero" required className={estiloEntrada} />
              </Campo>
            </div>
            <Campo rotulo="Objeto">
              <input name="objeto" className={estiloEntrada} />
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Tipo de instrumento" obrigatorio>
                <select name="tipo" defaultValue="colaboracao" className={estiloEntrada}>
                  {Object.entries(NOME_TIPO).map(([v, r]) => (
                    <option key={v} value={v}>
                      {r}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Descrição do tipo" dica="Só quando o tipo for “Outro”.">
                <input name="tipo_descricao" className={estiloEntrada} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Início da vigência" obrigatorio>
                <input type="date" name="inicio" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Fim da vigência" obrigatorio>
                <input type="date" name="fim" required className={estiloEntrada} />
              </Campo>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Unidade da meta" obrigatorio dica="Ex.: alunos, usuários, pessoas, procedimentos.">
                <input name="unidade_meta" required className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Recursos próprios previstos do termo (opcional)">
                <input name="recursos_proprios" inputMode="decimal" className={estiloEntrada} />
              </Campo>
            </div>
          </div>
        </Secao>
        <Secao titulo="Serviço atendido" descricao="As vagas custeadas entram no cálculo do valor per capita; as oferecidas são só informação.">
          <div className="space-y-4">
            <Campo rotulo="Serviço" obrigatorio>
              <select name="servico" required className={estiloEntrada}>
                {servicos.map((s) => (
                  <option key={s.codigo} value={s.codigo}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </Campo>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Vagas oferecidas">
                <input name="vagas_oferecidas" inputMode="numeric" className={estiloEntrada} />
              </Campo>
              <Campo rotulo="Vagas custeadas pelo termo">
                <input name="vagas_custeadas" inputMode="numeric" className={estiloEntrada} />
              </Campo>
            </div>
          </div>
        </Secao>
        <Secao titulo="Primeira fonte">
          <CamposFonte />
        </Secao>
        <BotaoEnviar enviando="Salvando…" className="w-full">
          Cadastrar termo
        </BotaoEnviar>
      </form>
    </div>
  );
}
