import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { instituicaoAtual } from '@/plataforma/instituicao';
import { usuarioLogado } from '@/plataforma/sessao';
import { LinkBotao, pequeno } from '@/ui/botao';
import { NOME_PLATAFORMA, textoVersao } from '@/ui/marca';
import { CabecalhoPagina } from '@/ui/pagina';

export const metadata: Metadata = { title: 'Ajuda' };

/**
 * Ajuda dentro da plataforma: o passo a passo de cada tela, mostrando só o que
 * o perfil de quem está vendo pode fazer (as mesmas permissões que montam o menu).
 * Cada assunto tem atalhos para as telas de que fala. O manual completo (PDF)
 * tem o mesmo conteúdo, para baixar e compartilhar.
 */
interface Assunto {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: ReactNode;
  atalhos?: { rotulo: string; href: string }[];
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

function Itens({ itens }: { itens: (ReactNode | false)[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {itens.filter(Boolean).map((t, i) => (
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
  const instituicao = await instituicaoAtual();
  const decide = a.temPermissao('orcamento.previsao.editar');
  const pode = {
    decide,
    aprova: a.temPermissao('orcamento.exercicio.aprovar'),
    // O Financeiro também tem "propor", mas usa as telas de lançamento e decisão.
    propor: a.temPermissaoAlgumEscopo('orcamento.previsao.propor') && !decide,
    cotar: a.temPermissao('orcamento.previsao.cotar'),
    paineis: a.temPermissao('orcamento.painel.ver') || decide,
    folhaResumo: a.temPermissaoAlgumEscopo('orcamento.folha.ver'),
    folhaCompleta: a.temPermissao('orcamento.folha.ver_individual'),
    folhaEditar: a.temPermissao('orcamento.folha.editar'),
    parametros: a.temPermissao('orcamento.parametros.editar'),
    organizacao: a.temPermissao('core.organizacao.gerenciar'),
    acessos: a.temPermissao('core.acessos.gerenciar'),
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
              `Abra o endereço do ${NOME_PLATAFORMA} da ${instituicao.nome} no navegador do computador ou do celular. Cada instituição tem o próprio endereço e os próprios dados.`,
              'Clique em Entrar com Google e use a sua conta institucional, do domínio da sua instituição. Contas pessoais (Gmail) e de outras instituições não entram.',
              'Se aparecer a mensagem de que o seu e-mail ainda não tem acesso, peça à Administração da plataforma para cadastrar o seu e-mail e o seu perfil.',
            ]}
          />
          <p className="mt-2">A sessão dura 8 horas. Para sair antes, use o botão ao lado do seu nome, no pé do menu.</p>
          <Sub>Em todas as telas</Sub>
          <Itens
            itens={[
              'Tabelas: clique no título de uma coluna para ordenar. "Filtrar colunas" abre uma caixa de busca em cada coluna; "Colunas" mostra ou esconde colunas extras.',
              'Formulários abrem numa janela por cima da tela. O botão principal grava; o X (ou Cancelar, quando aparece) fecha sem gravar.',
              'Excluir não apaga: o registro sai das listas e fica guardado. Grupos de gasto, fontes, áreas e serviços excluídos podem ser reativados na própria tela.',
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
      atalhos: [{ rotulo: 'Abrir Propostas', href: '/orcamento/previsao/propostas' }],
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
      atalhos: [{ rotulo: 'Ver as que aguardam cotação', href: '/orcamento/previsao/propostas?filtro=aguardando' }],
      conteudo: (
        <Passos
          itens={[
            'Abra Orçamento › Cotações e clique em "Aguardando cotação", no alto da lista, para ver só as que ainda não têm valor.',
            'Clique no lápis da proposta e informe quantidade, vezes, valor unitário, a situação da cotação e os meses.',
            'Use a observação para registrar a origem do preço (ex.: "3 orçamentos, menor preço da loja X").',
            'Clique em Salvar cotação. A proposta continua aguardando a decisão do Financeiro.',
          ]}
        />
      ),
    });
  }

  if (pode.decide || pode.aprova) {
    assuntos.push({
      id: 'orcamento',
      titulo: pode.decide ? 'Orçamento do ano: lançar, decidir e aprovar' : 'Orçamento do ano: aprovar e acompanhar mudanças',
      resumo: pode.decide ? 'Exercício, despesas, receitas, propostas e remanejamentos.' : 'Aprovação do exercício, remanejamentos e suplementações.',
      atalhos: [
        { rotulo: 'Previsão do ano', href: '/orcamento/previsao' },
        ...(pode.decide ? [{ rotulo: 'Propostas', href: '/orcamento/previsao/propostas' }] : []),
        { rotulo: 'Remanejamentos', href: '/orcamento/previsao/ajustes' },
      ],
      conteudo: (
        <>
          <p>
            O exercício passa por três situações: em elaboração (tudo pode ser lançado), aprovado (só muda por remanejamento ou suplementação aprovados pela
            Diretoria) e encerrado.
          </p>
          {pode.decide && (
            <>
              <Sub>Lançar</Sub>
              <Itens
                itens={[
                  'Antes de tudo, confira em Cadastros os Grupos de gasto (marque os de Recursos Humanos) e as Fontes de recurso (natureza e uso).',
                  'Em Previsão do ano, use Abrir exercício para começar um ano novo.',
                  'Despesas › Lançar despesa: serviço, grupo, fonte (pode ficar "a definir" na elaboração), quantidade × vezes × valor unitário e os meses.',
                  'A folha de pagamento entra sozinha, por serviço. No fim da tela Despesas, escolha a fonte que paga a folha de cada serviço: ao escolher, já fica salvo.',
                  'Receitas › Lançar receita: fonte, área, valor, meses e a situação da captação (garantida, em negociação ou a captar).',
                ]}
              />
              <Sub>Decidir as propostas</Sub>
              <Itens
                itens={[
                  'Em Propostas, aceite (entra no orçamento), ajuste antes de aceitar ou recuse escrevendo o motivo.',
                  'Proposta sem valor não pode ser aceita: clique em "Aguardando cotação" para vê-las, espere a cotação de Compras ou use Ajustar.',
                ]}
              />
            </>
          )}
          {pode.aprova && (
            <>
              <Sub>Aprovar</Sub>
              <p>
                Na Previsão do ano, o quadro da situação lista o que falta: fontes “a definir” e propostas aguardando decisão. Com tudo resolvido, o botão
                Aprovar fica disponível. Depois do ano, a Diretoria encerra o exercício.
              </p>
            </>
          )}
          <Sub>Depois de aprovado</Sub>
          <Itens
            itens={[
              'Remanejamento move valor de uma despesa para outra no mesmo mês; o total não muda.',
              'Suplementação aumenta ou reduz uma despesa ou receita e muda o total.',
              pode.decide && 'Peça em Remanejamentos, com justificativa. A Diretoria aprova ou recusa com motivo.',
              pode.aprova && 'Em Remanejamentos, aprove ou recuse cada pedido do Financeiro (a recusa pede motivo).',
            ]}
          />
        </>
      ),
    });
  }

  if (pode.paineis) {
    assuntos.push({
      id: 'paineis',
      titulo: 'Painéis: acompanhar e comparar',
      resumo: 'Previsão do ano, Painel geral e Análise por área.',
      atalhos: [
        { rotulo: 'Painel geral', href: '/orcamento/previsao/geral' },
        { rotulo: 'Análise por área', href: '/orcamento/previsao/areas' },
      ],
      conteudo: (
        <Itens
          itens={[
            'Previsão do ano: situação do exercício, o que falta para aprovar, os totais e a tabela mês a mês (clique em ▸ para abrir grupos e itens).',
            'Painel geral: escolha o ano no alto. Indicadores com limite de referência (folha até 65% da receita, dependência de recursos públicos até 70%), sobra ou falta em cada mês, receita × despesa por fonte e comparação entre anos. Em todo gráfico, "Ver os números" mostra a tabela.',
            'Análise por área: escolha a área, as categorias e a base de rateio e clique em Aplicar. Mostra custo direto, rateio do indireto e das despesas administrativas e custo por atendido.',
          ]}
        />
      ),
    });
  }

  if (pode.folhaResumo) {
    assuntos.push({
      id: 'folha',
      titulo: 'Folha de pagamento',
      resumo: pode.folhaEditar ? 'Resumo, folha completa, lotação, parâmetros e importação da planilha.' : 'Como ler o resumo da folha.',
      atalhos: [
        { rotulo: 'Resumo da folha', href: '/orcamento' },
        ...(pode.folhaEditar ? [{ rotulo: 'Lotação', href: '/orcamento/lotacao' }] : []),
      ],
      conteudo: (
        <>
          <Itens
            itens={[
              'Resumo da folha: total do mês escolhido e do ano, com os quadros CEBAS e FGTS e o total por serviço. Você vê os totais do seu escopo.',
              pode.folhaCompleta && 'Folha completa: todas as colunas, com as calculadas destacadas. Abrir a ficha de uma pessoa fica registrado.',
              pode.folhaEditar && 'Lotação: em quais serviços cada funcionário trabalha, em percentual. Cada funcionário precisa somar exatamente 100%.',
              pode.parametros && 'Parâmetros: ano da folha, reajuste, hora atividade e percentuais de encargos.',
            ]}
          />
          {pode.folhaEditar && (
            <>
              <Sub>Importar a planilha da folha</Sub>
              <Passos
                itens={[
                  'No Google Drive, baixe a planilha da folha em Excel (.xlsx).',
                  'Em Importar planilha, clique em Escolher arquivo .xlsx.',
                  'Diga em qual aba estão os dados e qual coluna corresponde a cada campo (o sistema sugere). Faça o mesmo para a lotação.',
                  'Confira o resumo e confirme. Códigos já cadastrados são ignorados: dá para importar de novo com segurança.',
                ]}
              />
            </>
          )}
        </>
      ),
    });
  }

  if (pode.organizacao || pode.acessos) {
    assuntos.push({
      id: 'administracao',
      titulo: 'Administração',
      resumo: 'Serviços, áreas, acessos e estrutura das planilhas.',
      atalhos: [
        ...(pode.acessos ? [{ rotulo: 'Acessos', href: '/admin/acessos' }] : []),
        ...(pode.organizacao ? [{ rotulo: 'Serviços', href: '/admin/servicos' }] : []),
      ],
      conteudo: (
        <Itens
          itens={[
            pode.organizacao && 'Serviços: os centros de custo, cada um numa área e numa unidade. "Cadastrar em lote" cadastra vários de uma vez; excluídos podem ser reativados em "Serviços excluídos".',
            pode.organizacao && 'Áreas: o nome é único; não há duas áreas com o mesmo nome.',
            pode.acessos && 'Acessos: "Dar acesso" cadastra o e-mail institucional e o primeiro perfil; "Atribuir perfil" acrescenta outro. Em "Vale para", escolha toda a instituição, uma unidade, uma área ou um serviço.',
            pode.organizacao && 'Estrutura das planilhas: "Preparar estrutura" cria as abas, colunas, perfis e permissões que faltam. Rode sempre que o Elo avisar (selo "Atualizar" no menu ou aviso na tela inicial), se a Administração da rede ainda não tiver feito isso; depois, quem estiver usando deve sair e entrar de novo. Nada é apagado.',
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
            ['Não vejo um item no menu.', 'O menu mostra só o que o seu perfil permite. Peça à Administração da plataforma para conferir o seu perfil. Logo depois de uma atualização do Elo, pode faltar rodar "Preparar estrutura": a Administração recebe esse aviso.'],
            ['Diz que o registro foi alterado por outra pessoa.', 'Outra pessoa salvou primeiro. Recarregue a tela, confira e faça a sua alteração de novo.'],
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
            'Nada é apagado, e cada alteração fica registrada com quem fez e quando, sem copiar os valores.',
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
      <section aria-label="Manual completo" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-borda bg-superficie px-5 py-4">
        <div>
          <p className="font-bold">Manual completo do {NOME_PLATAFORMA}</p>
          <p className="text-sm text-texto-suave">Todas as telas e todos os perfis num documento só, para ler, imprimir ou compartilhar (PDF).</p>
        </div>
        <LinkBotao href="/manual/manual-elo.pdf" target="_blank" rel="noopener" variante="secundario" download="Manual do Elo.pdf">
          Baixar o manual (PDF)
        </LinkBotao>
      </section>
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
              {s.atalhos && s.atalhos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.atalhos.map((t) => (
                    <LinkBotao key={t.href} href={t.href} variante="secundario" className={pequeno}>
                      {t.rotulo}
                    </LinkBotao>
                  ))}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
