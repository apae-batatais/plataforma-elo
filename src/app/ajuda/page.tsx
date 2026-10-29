import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { instituicaoAtual } from '@/plataforma/instituicao';
import { usuarioLogado } from '@/plataforma/sessao';
import { NOME_PLATAFORMA, textoVersao } from '@/ui/marca';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Ajuda' };

/**
 * Ajuda dentro da plataforma: o passo a passo de cada tela, mostrando só os
 * assuntos que o perfil de quem está vendo pode usar. O manual completo (documento)
 * tem o mesmo conteúdo, para baixar e compartilhar.
 */
interface Assunto {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: ReactNode;
}

function Passos({ itens }: { itens: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5">
      {itens.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  );
}

function Itens({ itens }: { itens: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {itens.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

const Sub = ({ children }: { children: ReactNode }) => <h3 className="mt-5 font-semibold first:mt-0">{children}</h3>;

export default async function Ajuda() {
  const usuario = await usuarioLogado();
  if (!usuario) redirect('/entrar');
  const a = usuario.autorizador;
  const instituicao = instituicaoAtual();
  const pode = {
    orcamento: a.temPermissao('orcamento.acessar'),
    previsao: a.temPermissao('orcamento.painel.ver') || a.temPermissao('orcamento.previsao.editar'),
    propor: a.temPermissaoAlgumEscopo('orcamento.previsao.propor'),
    cotar: a.temPermissao('orcamento.previsao.cotar'),
    folha: a.temPermissao('orcamento.folha.ver'),
    admin: a.temPermissao('core.organizacao.gerenciar') || a.temPermissao('core.acessos.gerenciar'),
  };

  const assuntos: Assunto[] = [
    {
      id: 'primeiros-passos',
      titulo: 'Primeiros passos',
      resumo: 'Como entrar, como a tela é organizada e o que vale em todas as telas.',
      conteudo: (
        <>
          <Sub>Como entrar</Sub>
          <Passos
            itens={[
              `Abra o endereço do ${NOME_PLATAFORMA} no navegador do computador ou do celular.`,
              'Clique em Entrar com Google e use a sua conta institucional. Contas pessoais (Gmail) não entram.',
              'Se aparecer "Sem acesso", peça à Administração da plataforma para cadastrar o seu e-mail e o seu perfil.',
            ]}
          />
          <p className="mt-2">A sessão dura 8 horas. Para sair antes, use o botão ao lado do seu nome, no pé do menu.</p>
          <Sub>Em todas as telas</Sub>
          <Itens
            itens={[
              'Tabelas: clique no título de uma coluna para ordenar. "Filtrar colunas" busca dentro de cada coluna; "Colunas" mostra ou esconde colunas extras.',
              'Formulários abrem numa janela por cima da tela. Salvar grava; Cancelar ou o X fecha sem gravar.',
              'Excluir não apaga: o registro sai das listas, mas fica guardado e pode ser reativado em "Ver excluídos", quando a tela oferece.',
              'Se outra pessoa salvou o mesmo registro antes de você, nada é sobrescrito: recarregue a tela e faça a alteração de novo.',
            ]}
          />
        </>
      ),
    },
  ];

  if (pode.propor) {
    assuntos.push({
      id: 'propor',
      titulo: 'Propor despesas para os meus serviços',
      resumo: 'Para coordenações: o que pedir para o orçamento do próximo ano.',
      conteudo: (
        <Passos
          itens={[
            'Abra Orçamento › Propostas e clique em Propor despesa.',
            'Escolha o serviço, o grupo de gasto e descreva o item. Se souber, informe quantidade, vezes e valor unitário; se não souber, deixe em branco: o Setor de Compras cota.',
            'Se a compra tem mês certo, escreva na observação (ex.: "precisa em março").',
            'Acompanhe a situação na lista. Enquanto a proposta aguarda, dá para alterar ou retirar. Se for recusada, o motivo aparece embaixo da situação.',
          ]}
        />
      ),
    });
  }

  if (pode.cotar) {
    assuntos.push({
      id: 'cotar',
      titulo: 'Cotar propostas',
      resumo: 'Para o Setor de Compras: informar o valor das propostas das coordenações.',
      conteudo: (
        <Passos
          itens={[
            'Abra Orçamento › Cotações. O aviso no alto mostra quantas propostas aguardam cotação.',
            'Na coluna Cotação, filtre por "Aguardando cotação" para ver só essas.',
            'Clique no lápis, informe quantidade, vezes, valor unitário, a situação da cotação e os meses. Use a observação para registrar a origem do preço (ex.: "3 orçamentos, menor preço da loja X").',
            'Salve. A proposta continua aguardando a decisão do Financeiro.',
          ]}
        />
      ),
    });
  }

  if (pode.previsao) {
    assuntos.push(
      {
        id: 'orcamento',
        titulo: 'Orçamento do ano: lançar, decidir e aprovar',
        resumo: 'Exercício, despesas, receitas, propostas, aprovação e remanejamentos.',
        conteudo: (
          <>
            <p>
              O exercício passa por três situações: em elaboração (tudo pode ser lançado), aprovado (só muda por remanejamento ou suplementação aprovados pela
              Diretoria) e encerrado.
            </p>
            <Sub>Lançar (Financeiro)</Sub>
            <Itens
              itens={[
                'Antes de tudo, confira em Cadastros os Grupos de gasto (marque os de Recursos Humanos) e as Fontes de recurso (natureza e uso).',
                'Despesas › Lançar despesa: serviço, grupo, fonte (pode ficar "a definir" na elaboração), quantidade × vezes × valor unitário e os meses.',
                'A folha de pagamento entra sozinha, por serviço. No fim da tela Despesas, escolha a fonte que paga a folha de cada serviço: ao escolher, já fica salvo.',
                'Receitas › Lançar receita: fonte, área, valor, meses e a situação da captação (garantida, em negociação ou a captar).',
              ]}
            />
            <Sub>Decidir as propostas (Financeiro)</Sub>
            <Itens
              itens={[
                'Em Propostas, aceite (entra no orçamento), ajuste antes de aceitar ou recuse escrevendo o motivo.',
                'Proposta sem valor não pode ser aceita: aguarde a cotação de Compras ou use Ajustar.',
              ]}
            />
            <Sub>Aprovar (Diretoria)</Sub>
            <p>
              Na Previsão do ano, o quadro da situação lista o que falta: fontes “a definir” e propostas aguardando decisão. Com tudo resolvido, o botão
              Aprovar fica disponível. Depois do ano, a Diretoria encerra o exercício.
            </p>
            <Sub>Depois de aprovado</Sub>
            <Itens
              itens={[
                'Remanejamento move valor de uma despesa para outra no mesmo mês; o total não muda.',
                'Suplementação aumenta ou reduz uma despesa ou receita e muda o total.',
                'O Financeiro pede em Remanejamentos, com justificativa; a Diretoria aprova ou recusa com motivo.',
              ]}
            />
          </>
        ),
      },
      {
        id: 'paineis',
        titulo: 'Painéis: acompanhar e comparar',
        resumo: 'Previsão do ano, Painel geral e Análise por área.',
        conteudo: (
          <Itens
            itens={[
              'Previsão do ano: situação do exercício, o que falta para aprovar, os totais e a tabela mês a mês (clique em ▸ para abrir grupos e itens).',
              'Painel geral: escolha o ano no alto. Indicadores com limite de referência (folha até 65% da receita, dependência de recursos públicos até 70%), sobra ou falta em cada mês, receita × despesa por fonte e comparação entre anos. Em todo gráfico, "Ver os números" mostra a tabela.',
              'Análise por área: escolha a área, as categorias e a base de rateio e clique em Aplicar. Mostra custo direto, rateio do indireto e das despesas administrativas e custo por atendido.',
            ]}
          />
        ),
      },
    );
  }

  if (pode.folha) {
    assuntos.push({
      id: 'folha',
      titulo: 'Folha de pagamento',
      resumo: 'Resumo, folha completa, lotação, parâmetros e importação da planilha.',
      conteudo: (
        <>
          <Itens
            itens={[
              'Resumo da folha: total do mês escolhido e do ano, com os quadros CEBAS e FGTS e o total por serviço.',
              'Folha completa (só quem pode ver salários): abrir a ficha de uma pessoa fica registrado na auditoria.',
              'Lotação: em quais serviços cada funcionário trabalha, em percentual. Cada funcionário precisa somar exatamente 100%.',
              'Parâmetros (Financeiro): ano da folha, reajuste, hora atividade e percentuais de encargos.',
            ]}
          />
          <Sub>Importar a planilha da folha</Sub>
          <Passos
            itens={[
              'No Google Drive, baixe a planilha da folha em Excel (.xlsx).',
              'Em Importar planilha, clique em Escolher arquivo .xlsx.',
              'Diga em qual aba estão os dados e qual coluna corresponde a cada campo (o sistema sugere). Faça o mesmo para a lotação.',
              'Confira o resumo e confirme. Quem já está cadastrado não é alterado: dá para importar de novo com segurança.',
            ]}
          />
        </>
      ),
    });
  }

  if (pode.admin) {
    assuntos.push({
      id: 'administracao',
      titulo: 'Administração',
      resumo: 'Serviços, áreas, acessos e estrutura das planilhas.',
      conteudo: (
        <Itens
          itens={[
            'Serviços: os centros de custo, cada um numa área e numa unidade. "Cadastrar em lote" cadastra vários de uma vez.',
            'Áreas: o nome é único; não há duas áreas com o mesmo nome.',
            'Acessos: "Dar acesso" cadastra o e-mail institucional e o primeiro perfil; "Atribuir perfil" acrescenta outro. Escolha o escopo: toda a instituição, unidade, área ou serviço.',
            'Estrutura das planilhas: "Preparar estrutura" cria as abas e colunas que faltam. Rode depois de cada atualização que avise sobre abas novas. Nada é apagado.',
          ]}
        />
      ),
    });
  }

  assuntos.push({
    id: 'duvidas',
    titulo: 'Dúvidas frequentes e cuidados com os dados',
    resumo: 'O que fazer quando algo não aparece ou não deixa salvar.',
    conteudo: (
      <>
        <dl className="space-y-3">
          {[
            ['Não vejo um item no menu.', 'O menu mostra só o que o seu perfil permite. Peça à Administração da plataforma para conferir o seu perfil.'],
            ['Diz que alguém alterou antes de mim.', 'Outra pessoa salvou primeiro. Recarregue a tela, confira e faça a sua alteração de novo.'],
            ['Não consigo aprovar o exercício.', 'O botão só libera sem fonte "a definir" e sem proposta aguardando decisão. A Previsão do ano mostra o que falta.'],
            ['Um funcionário não aparece em nenhum serviço.', 'A lotação dele não soma 100%. Corrija em Folha de pagamento › Lotação.'],
          ].map(([p, r]) => (
            <div key={p}>
              <dt className="font-semibold">{p}</dt>
              <dd className="text-texto-suave">{r}</dd>
            </div>
          ))}
        </dl>
        <Sub>Cuidados com os dados</Sub>
        <Itens
          itens={[
            `Altere dados só pelo ${NOME_PLATAFORMA}. As planilhas no Drive são o armazenamento: editar à mão pode impedir a leitura.`,
            'Nada é apagado e o histórico registra quem mudou o quê e quando, sem copiar os valores.',
            'Salários e dados de atendidos são pessoais: evite capturas de tela e listas exportadas sem necessidade.',
            `Ao relatar um problema, informe a tela e a versão (${textoVersao()}).`,
          ]}
        />
      </>
    ),
  });

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        trilha={[{ rotulo: 'Início', href: '/' }, { rotulo: 'Ajuda' }]}
        titulo="Ajuda"
        descricao={`Como usar o ${NOME_PLATAFORMA} na ${instituicao.nome}. Aparecem aqui só os assuntos do seu perfil.`}
      />
      <nav aria-label="Assuntos" className="flex flex-wrap gap-2">
        {assuntos.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-borda bg-superficie px-3 py-1 text-sm hover:border-destaque/60">
            {s.titulo}
          </a>
        ))}
      </nav>
      <div className="space-y-3">
        {assuntos.map((s, i) => (
          <details key={s.id} id={s.id} open={i === 0} className="group scroll-mt-20 rounded-xl border border-borda bg-superficie">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4">
              <span>
                <span className="block text-lg font-bold">{s.titulo}</span>
                <span className="block text-sm text-texto-suave">{s.resumo}</span>
              </span>
              <span aria-hidden="true" className="mt-1 text-texto-suave transition-transform group-open:rotate-90">
                ▸
              </span>
            </summary>
            <div className="border-t border-borda px-5 py-4">
              <div className="max-w-3xl text-[0.95rem] leading-relaxed">{s.conteudo}</div>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
