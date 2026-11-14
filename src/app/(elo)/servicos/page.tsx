import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { Areas, Servicos } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { servicosVisiveis } from '@/plataforma/ligacoes';
import { usuarioLogado } from '@/plataforma/sessao';
import { CabecalhoPagina, EstadoVazio, Etiqueta } from '@/ui/pagina';
import { TabelaDados } from '@/ui/tabela-dados';

export const metadata: Metadata = { title: 'Serviços' };

export default async function ListaDeServicos() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  if (usuario.estruturaPendente) redirect('/admin/estrutura');
  const { planilhas } = await obterAplicacao();
  const [servicos, areas] = await lerTabelas(planilhas, [Servicos, Areas] as const);
  const nomeArea = new Map(areas.todos().map((a) => [a.codigo, a.nome]));
  const hoje = new Date().toISOString().slice(0, 10);
  const lista = servicosVisiveis(servicos.todos(), usuario.autorizador).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Serviços' }]}
        titulo="Serviços"
        descricao="Abra a ficha de um serviço para ver custo, vagas, projetos, requisições, publicações e avaliação juntos."
      />
      {lista.length === 0 ? (
        <EstadoVazio titulo="Nenhum serviço no seu escopo.">Fale com a administração se você deveria ver algum serviço.</EstadoVazio>
      ) : (
        <TabelaDados
          legenda="Serviços que você pode abrir"
          colunas={[
            { chave: 'nome', rotulo: 'Serviço' },
            { chave: 'area', rotulo: 'Área' },
            { chave: 'unidade', rotulo: 'Unidade' },
            { chave: 'vagas', rotulo: 'Vagas', tipo: 'numero' },
            { chave: 'situacao', rotulo: 'Situação' },
          ]}
          linhas={lista.map((s) => {
            const encerrado = Boolean(s.fim && s.fim < hoje);
            return {
              id: s.codigo,
              valores: { nome: s.nome, area: s.area ? (nomeArea.get(s.area) ?? s.area) : null, unidade: s.unidade, vagas: s.vagas, situacao: encerrado ? 'Encerrado' : 'Ativo' },
              celulas: {
                nome: <Link href={`/servicos/${s.codigo}`} className="font-medium text-destaque hover:underline">{s.nome}</Link>,
                situacao: <Etiqueta tipo={encerrado ? 'neutro' : 'sucesso'}>{encerrado ? 'Encerrado' : 'Ativo'}</Etiqueta>,
              },
            };
          })}
        />
      )}
    </div>
  );
}
