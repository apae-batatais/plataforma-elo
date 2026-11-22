import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { lerEncarregadoPublico } from '@/nucleo/encarregado/encarregado';
import { obterAplicacao } from '@/plataforma/aplicacao';
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
  const encarregado = await lerEncarregadoPublico((await obterAplicacao()).planilhas, a);
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
    requisitar: a.temPermissaoAlgumEscopo('requisicoes.solicitar'),
    aprovarRequisicao: a.temPermissaoAlgumEscopo('requisicoes.aprovar'),
    atenderRequisicao: a.temPermissaoAlgumEscopo('requisicoes.atender'),
    painelRequisicoes: a.temPermissaoAlgumEscopo('requisicoes.painel'),
    avaliar: a.temPermissaoAlgumEscopo('avaliacao.avaliar'),
    painelAvaliacao: a.temPermissaoAlgumEscopo('avaliacao.painel'),
    tiposRequisicao: a.temPermissao('requisicoes.tipos.gerenciar'),
    dpo: a.temPermissao('core.dpo.gerenciar'),
    comunicacao: a.temPermissaoAlgumEscopo('comunicacao.solicitar') || a.temPermissao('comunicacao.revisar'),
    equipeComunicacao: a.temPermissao('comunicacao.revisar'),
    configurarComunicacao: a.temPermissao('comunicacao.configurar'),
    resultadoInstagram: a.temPermissao('comunicacao.revisar'),
    indicadoresComunicacao: a.temPermissao('comunicacao.indicadores'),
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

  if (pode.requisitar) {
    assuntos.push({
      id: 'requisicoes',
      titulo: 'Requisições',
      resumo: 'Pedir materiais ao Almoxarifado, abrir chamados de TI e pedir mudança ou empréstimo de móveis; aprovar e atender, com histórico e prazos.',
      atalhos: [
        { rotulo: 'Nova requisição', href: '/requisicoes/nova' },
        ...(pode.aprovarRequisicao ? [{ rotulo: 'Para aprovar', href: '/requisicoes/aprovar' }] : []),
        ...(pode.atenderRequisicao ? [{ rotulo: 'Para atender', href: '/requisicoes/atender' }] : []),
        ...(pode.painelRequisicoes ? [{ rotulo: 'Painel de prazos', href: '/requisicoes/painel' }] : []),
      ],
      conteudo: (
        <>
          <Sub>Pedir</Sub>
          <Passos
            itens={[
              'Abra Requisições › Nova requisição.',
              'Escolha o tipo (ex.: Higiene e limpeza) e a área. Aparecem só as áreas que o tipo aceita.',
              'Em Centros de custo, escolha um ou mais serviços da mesma coordenação, somando 100%. "Dividir igualmente" reparte para você.',
              'Liste os itens. Se o tipo tem lista de itens, comece a digitar e escolha da lista: a unidade vem preenchida. Diga se é retirada ou entrega e, se for para um evento, marque "É para um evento" e preencha os dados.',
              'Clique em Enviar requisição. Acompanhe em Minhas requisições: clique no número para ver a ficha, o histórico e os prazos.',
              'Se a requisição for devolvida, a tela inicial avisa. Abra a ficha, clique em Ajustar e reenviar, faça o ajuste pedido e reenvie. Enquanto não for aprovada, dá para cancelar.',
            ]}
          />
          <Sub>Resumo diário por e-mail</Sub>
          <Passos
            itens={[
              'Se a instituição tem e-mail de envio cadastrado, você recebe de manhã (por volta das 7h, em dia útil) um resumo só seu: quantas requisições esperam a sua aprovação, quantas suas foram devolvidas e quantas estão atrasadas no seu setor ou escopo.',
              'O e-mail só traz números e o link do Elo, sem dados dos pedidos. Se você não tem nada pendente, não recebe nada. Para agir, abra Requisições pelo link.',
            ]}
          />
          <Sub>Chamado de TI</Sub>
          <Passos
            itens={[
              'Em Nova requisição, escolha o tipo Chamado de TI. Para pedir mouse, teclado, toner e outros suprimentos, use o tipo de material de informática.',
              'Diga do que é o chamado (computador, sistema, internet, impressora, acesso ou outro), onde está, o que está acontecendo e a urgência. Equipamento, nº de patrimônio e um contato ajudam o técnico.',
              'O chamado passa pela mesma aprovação e vai para o Setor de Informática. Quando concluído, o histórico mostra o que foi feito.',
            ]}
          />
          <Sub>Mobiliário</Sub>
          <Passos
            itens={[
              'Em Nova requisição, escolha o tipo Mobiliário e o que precisa ser feito: mudar de lugar, emprestar (para evento ou por um período), recolher (quebrado ou sem uso), montar ou desmontar.',
              'Liste os móveis (quantidade, descrição e nº de patrimônio, se houver), de onde, para onde e para quando. No empréstimo, informe também quando os móveis voltam.',
              'O pedido passa pela mesma aprovação e vai para o Setor de Patrimônio, que marca o que foi feito ao concluir.',
            ]}
          />
          <Sub>Manutenção</Sub>
          <Passos
            itens={[
              'Em Nova requisição, escolha o tipo Manutenção e o tipo de serviço: elétrica, hidráulica, ar-condicionado, equipamento, portas e janelas, pintura, prédio ou outro.',
              'Diga onde é o serviço, qual é o problema (com detalhes: o que aconteceu, desde quando, se há risco) e a urgência. Equipamento, nº de patrimônio, melhor horário e contato ajudam a equipe.',
              'O pedido passa pela mesma aprovação e vai para o Setor de Manutenção. Quando concluído, o histórico mostra o que foi feito.',
            ]}
          />
          <Sub>Fotos e vídeo</Sub>
          <Itens
            itens={[
              'Nos tipos que aceitam (como Manutenção, TI e Mobiliário), a ficha tem o bloco "Fotos e vídeo". No celular, "Tirar foto" e "Gravar vídeo" abrem a câmera direto; "Escolher arquivo" usa a galeria.',
              'Até 3 fotos e 1 vídeo de até 30 segundos (25 MB). A foto é reduzida automaticamente antes do envio. Espere o envio terminar ("Enviado") para mandar a requisição.',
              'Mostre o problema e evite o rosto de atendidos. Só quem vê a requisição vê as fotos e o vídeo, e cada abertura fica registrada.',
            ]}
          />
          <Sub>Quem aprova</Sub>
          <Itens
            itens={[
              'A coordenação dos centros de custo. Uma requisição não pode misturar serviços de coordenações diferentes: abra uma para cada.',
              'Pedido feito pela própria coordenação, ou de serviço sem coordenação cadastrada, é aprovado pela Diretoria.',
            ]}
          />
          {pode.aprovarRequisicao && (
            <>
              <Sub>Aprovar</Sub>
              <Passos
                itens={[
                  'Abra Requisições › Para aprovar (a tela inicial e o número no menu mostram quantas esperam por você).',
                  'Abra a ficha e clique em Aprovar. Para devolver ou recusar, escreva o motivo e clique no botão: quem pediu vê no histórico.',
                ]}
              />
            </>
          )}
          {pode.atenderRequisicao && (
            <>
              <Sub>Atender</Sub>
              <Passos
                itens={[
                  'Abra Requisições › Para atender: estão ali as requisições aprovadas dos tipos do seu setor.',
                  'Na ficha, clique em Receber para atender. Ao entregar, confira a quantidade entregue de cada item e clique em Concluir atendimento. Se faltou algo, explique no comentário: fica como "atendida em parte".',
                  'Chamados (TI): a lista mostra a urgência; clique no título "Urgência" para ordenar. Ao concluir, marque se resolveu e descreva o que foi feito.',
                  'Mobiliário: ao concluir, marque se foi feito (ou feito em parte) e descreva o que foi feito.',
                  'Manutenção: a lista mostra a urgência, como nos chamados. Ao concluir, marque se resolveu e descreva o que foi feito.',
                ]}
              />
            </>
          )}
          <Sub>Prazos (SLA)</Sub>
          <p>
            Cada tipo tem um prazo de aprovação e um de atendimento, em horas úteis (segunda a sexta, no expediente, fora os feriados cadastrados). A ficha e as
            listas mostram se a etapa está no prazo ou atrasada. Para imprimir ou salvar em PDF, use o botão Imprimir da ficha.
          </p>
          {pode.painelRequisicoes && (
            <>
              <Sub>Painel de prazos</Sub>
              <Itens
                itens={[
                  'Em Requisições › Painel de prazos, veja o percentual decidido e atendido dentro do prazo, o tempo médio de cada etapa e as atendidas em parte. O padrão são os últimos 6 meses; escolha outro período no topo.',
                  'A aprovação conta no mês em que foi decidida; o atendimento, no mês em que foi concluído. As tabelas separam por mês, por setor e por tipo; clique no título de uma coluna para ordenar.',
                  '"Atrasadas agora" lista o que está esperando decisão ou atendimento além do prazo, da mais atrasada para a menos atrasada. Clique no número para abrir a ficha.',
                  'A Diretoria vê todas as requisições; a coordenação, as do seu escopo; cada setor, as dos seus tipos.',
                ]}
              />
            </>
          )}
          {pode.tiposRequisicao && (
            <>
              <Sub>Tipos de requisição</Sub>
              <p>
                Em Requisições › Tipos de requisição (só a Administração da plataforma), cadastre os tipos, o setor que atende (perfis Almoxarifado, Setor de
                Informática, Setor de Patrimônio, Setor de Manutenção ou Setor Cozinha, que você atribui às pessoas do setor em Acessos), os prazos e quais
                áreas podem usar cada tipo (sem marcação, todas podem). Em &ldquo;Itens aceitos&rdquo;, monte a lista de itens do tipo, um a um ou colando da
                planilha: quem pede escolhe da lista e a unidade vem preenchida. Tipo sem lista aceita itens digitados. Marque &ldquo;Aceita foto e vídeo&rdquo;
                nos tipos em que uma foto ajuda (manutenção, TI, mobiliário). No fim da tela fica o horário do expediente. Os feriados, que valem para todos os apps,
                ficam em Administração › Feriados: o botão &ldquo;Incluir feriados nacionais&rdquo; cadastra de uma vez os do ano (com o 9 de julho, de São Paulo);
                os municipais e os pontos facultativos você inclui um a um.
              </p>
            </>
          )}
        </>
      ),
    });
  }

  if (pode.avaliar || pode.painelAvaliacao) {
    assuntos.push({
      id: 'avaliacao',
      titulo: 'Assistência Social',
      resumo: 'Avaliar as pessoas atendidas na entrada e uma vez por ano, comparar a evolução de cada uma e acompanhar os indicadores por serviço.',
      atalhos: [
        ...(pode.avaliar ? [{ rotulo: 'Nova avaliação', href: '/avaliacao/nova' }] : []),
        ...(pode.painelAvaliacao ? [{ rotulo: 'Painel', href: '/avaliacao/painel' }] : []),
        { rotulo: 'Sobre o instrumento', href: '/avaliacao/sobre' },
      ],
      conteudo: (
        <>
          {pode.avaliar && (
            <>
              <Sub>Avaliar</Sub>
              <Passos
                itens={[
                  'Abra Avaliações › Assistência Social › Nova avaliação e escolha o tipo: Inicial (quando a pessoa é encaminhada ao serviço) ou Acompanhamento anual.',
                  'Identifique a pessoa só pelas iniciais, data de nascimento e sexo. O prontuário é opcional e o nome completo não é pedido.',
                  'Escolha o serviço atual (aparecem os serviços do seu escopo) e responda todas as perguntas. O que faltar fica em vermelho ao salvar.',
                  'O índice de necessidade de cuidado (0 a 12) é calculado enquanto você responde. Em suspeita de violação de direitos, siga o fluxo de notificação e o encaminhamento ao CREAS.',
                  'Clique em Salvar avaliação. Para corrigir, abra a avaliação na lista. Lançou por engano? Use Retirar avaliação e escreva o motivo: ela sai da lista e do painel, mas fica guardada.',
                  'A lista mostra a próxima avaliação de cada pessoa (12 meses depois da última), avisa 30 dias antes e marca as atrasadas. Use Reavaliar: a identificação, o serviço e o cuidador já vêm preenchidos.',
                  'Com duas ou mais avaliações da mesma pessoa, clique em Comparar: o índice e cada resposta aparecem lado a lado, com o que melhorou ou piorou da primeira para a última. Índice menor = melhora na qualidade de vida. O comparativo também pode ser impresso.',
                  'Para ter a avaliação no papel, clique em Ficha na lista (ou Imprimir ficha dentro da avaliação) e depois em Imprimir ou salvar em PDF. A ficha tem campo de assinatura e contém dados sensíveis: guarde no prontuário.',
                ]}
              />
            </>
          )}
          {pode.painelAvaliacao && (
            <>
              <Sub>Painel</Sub>
              <Passos
                itens={[
                  'Abra Avaliações › Assistência Social › Painel. Os números são das avaliações dos serviços que você acompanha e não identificam ninguém.',
                  'Filtre por serviço e por período (meses da data da avaliação). Cada pessoa conta uma vez, pela avaliação mais recente. Em cada gráfico, "Ver os números" mostra a tabela.',
                  'O painel tem quatro partes: necessidade de cuidado, evolução (entre avaliações da mesma pessoa e a percebida pela equipe), dependência e transporte, e análise por sexo.',
                  'Para imprimir ou salvar em PDF, clique em Imprimir painel: os gráficos saem com as cores e com a tabela de números, sem quadro cortado entre as páginas.',
                ]}
              />
            </>
          )}
        </>
      ),
    });
  }

  if (pode.resultadoInstagram || pode.indicadoresComunicacao) {
    assuntos.push({
      id: 'resultado-instagram',
      titulo: 'Resultado das postagens do Instagram',
      resumo: 'Alcance, curtidas, comentários e salvamentos das postagens publicadas pelo Elo.',
      atalhos: [
        ...(pode.resultadoInstagram ? [{ rotulo: 'Abrir Pedidos', href: '/comunicacao/pedidos' }] : []),
        ...(pode.indicadoresComunicacao ? [{ rotulo: 'Abrir Indicadores', href: '/comunicacao/indicadores' }] : []),
      ],
      conteudo: (
        <>
          <p className="mb-2">O Elo busca sozinho os números, uma vez por dia, de madrugada, nas postagens publicadas por ele (até 90 dias depois de publicadas). Depois disso, ficam os últimos números.</p>
          <Itens
            itens={[
              pode.resultadoInstagram && 'No pedido: abra um pedido já publicado. Na faixa Instagram aparecem alcance, curtidas, comentários e salvamentos, com a data da última atualização. Se ainda não há número, aparece "Resultado ainda não disponível".',
              pode.resultadoInstagram && 'Se aparecer que não é possível buscar o resultado da conta, a coordenação precisa reconectar o Instagram em Configurações para liberar a leitura dos números.',
              pode.indicadoresComunicacao && 'Nos Indicadores: escolha mês, trimestre ou ano. O gráfico mostra o alcance médio por tipo de peça e a tabela traz uma linha por postagem do período.',
            ]}
          />
        </>
      ),
    });
  }

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
                  'Antes de tudo, confira em Cadastros os Grupos de contas (marque os de Recursos Humanos) e as Fontes de recurso (natureza e uso). "Cadastrar em lote" cadastra vários de uma vez, colando uma lista da planilha.',
                  'Em Previsão do ano, use Abrir exercício para começar um ano novo.',
                  'Despesas › Lançar despesa: serviço, grupo, fonte (pode ficar "a definir" na elaboração), quantidade × vezes × valor unitário e os meses.',
                  'Despesa dividida entre vários serviços: Despesas › Despesas por rateio › Novo lançamento. Preencha como uma despesa comum, escolha a Regra de rateio e use "Ver como ficaria" para conferir quanto cada serviço recebe. Ao salvar, o Elo gera uma despesa por serviço.',
                  'As despesas geradas aparecem na lista de Despesas com a etiqueta "Gerada por rateio" e não podem ser alteradas ali: use "Ver lançamento de origem". Enquanto o exercício está em elaboração, elas se recalculam sozinhas quando muda o lançamento, a regra, uma base própria, os números de um serviço (atendidos, m², vagas) ou a lotação. Depois de aprovado, ficam como estão. Excluir o lançamento encerra todas as despesas geradas.',
                  'A folha de pagamento entra sozinha, por serviço. No fim da tela Despesas, escolha a fonte que paga a folha de cada serviço: ao escolher, já fica salvo.',
                  'Receitas › Lançar receita: fonte, área, valor, meses e a situação da captação (garantida, em negociação ou a captar).',
                  'Para trazer de uma planilha: Importar despesas e receitas. Escolha o arquivo, diga se são despesas ou receitas e qual coluna corresponde a cada campo (o Elo sugere), confira e diga a qual cadastro corresponde cada nome que ele não reconheceu.',
                  'Importar de novo o mesmo tipo substitui a importação anterior do ano: os itens importados antes vão para o histórico. O que foi lançado à mão e as propostas não mudam.',
                ]}
              />
              <Sub>Plano de contas</Sub>
              <Itens
                itens={[
                  'Em Cadastros, cadastre as Áreas do plano (as áreas da contabilidade, que podem ser diferentes das áreas dos serviços) e, em Grupos de contas, os itens contábeis de cada grupo (botão "Cadastrar itens").',
                  'Planejamento › Plano de contas: escolha o exercício e use Montar plano. Em cada área, marque os grupos e os itens que ela usa e diga a partir de quando vale (dentro do ano). Salvar cria uma versão nova; as anteriores ficam em "Versões anteriores".',
                  'Para um ano novo, use "Começar do plano de" o ano anterior: o plano vem preenchido, você ajusta e salva. Nada é gravado até salvar.',
                  'O plano só orienta: nenhum lançamento é bloqueado por ele. "Baixar planilha" entrega o plano do exercício em CSV.',
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
      atalhos: [{ rotulo: 'Resumo da folha', href: '/orcamento/resumo' }, ...(pode.folhaEditar ? [{ rotulo: 'Lotação', href: '/orcamento/lotacao' }] : [])],
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
                  'Diga o que o arquivo traz: funcionários da folha, ou só a lotação (rateio) de quem já está cadastrado.',
                  'Diga em qual aba estão os dados e qual coluna corresponde a cada campo (o sistema sugere). Faça o mesmo para a lotação.',
                  'Confira o resumo e confirme. Quem já está cadastrado não é duplicado nem tem os valores alterados: dá para importar de novo com segurança.',
                  'Se o arquivo trouxer lotação para quem já está cadastrado: quem não tem recebe a do arquivo; quem tem uma diferente é atualizado a partir da data que você escolher, se você deixar marcado. A lotação anterior fica no histórico.',
                ]}
              />
            </>
          )}
        </>
      ),
    });
  }

  if (pode.comunicacao) {
    assuntos.push({
      id: 'comunicacao-avisos',
      titulo: 'Comunicação: avisos por e-mail',
      resumo: pode.configurarComunicacao ? 'Quais e-mails o Elo manda e como ligar ou desligar.' : 'Quais e-mails o Elo manda sobre os pedidos.',
      atalhos: [{ rotulo: 'Meus pedidos', href: '/comunicacao' }, ...(pode.configurarComunicacao ? [{ rotulo: 'Configurações da Comunicação', href: '/comunicacao/configuracoes' }] : [])],
      conteudo: (
        <>
          <p className="mb-3">
            Quando a instituição liga os avisos, o Elo manda um e-mail curto a quem precisa agir. O e-mail traz só o número do pedido, o que fazer e o link; nunca o
            título nem a descrição. O aviso dentro do Elo continua igual, com ou sem e-mail.
          </p>
          <Itens
            itens={[
              'Seu pedido foi devolvido para ajuste: quem fez o pedido recebe o aviso para abrir o Elo e ajustar.',
              'Seu pedido foi publicado: quem fez o pedido recebe o aviso.',
              pode.equipeComunicacao && 'Pedidos aguardando revisão: a Comunicação recebe um resumo quando chega pedido novo, não um e-mail por pedido.',
              pode.equipeComunicacao && 'Lembrete do dia: às 8h, a Comunicação recebe o resumo dos posts, reels e entrevistas marcados para hoje. Dia sem pedido não gera e-mail.',
              pode.equipeComunicacao && 'Envio de release ou artigo que falhou: a Comunicação recebe um aviso, e o pedido continua Agendado. Abra o pedido para "Tentar de novo" ou "Enviar à mão".',
              a.temPermissao('comunicacao.aprovar') && 'Pedido aguardando aprovação: a coordenação da Comunicação recebe o aviso para decidir.',
              'Em cada pedido, o histórico mostra se o aviso foi enviado ou não (sem o endereço de e-mail).',
            ]}
          />
          {pode.configurarComunicacao && (
            <>
              <Sub>Ligar ou desligar os avisos</Sub>
              <Passos
                itens={[
                  'Abra Comunicação › Configurações e vá até "Avisos por e-mail".',
                  'Confira o endereço em "Enviando por". Se aparecer "Falta informar o e-mail de envio", peça à Administração da rede para informá-lo; sem ele nenhum aviso sai.',
                  'Marque "Avisar por e-mail" (ou desmarque para desligar) e clique em "Salvar avisos". Os avisos começam desligados.',
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
            pode.organizacao &&
              'Serviços: os centros de custo, cada um numa área e numa unidade. "Cadastrar em lote" cadastra vários de uma vez; excluídos podem ser reativados em "Serviços excluídos".',
            pode.organizacao && 'Áreas: o nome é único; não há duas áreas com o mesmo nome.',
            pode.acessos &&
              'Acessos: "Dar acesso" cadastra o e-mail institucional e o primeiro perfil (já vem marcado Funcionário, o perfil básico de quem trabalha na instituição: faz requisições e acompanha as suas); "Atribuir perfil" acrescenta outro. Em "Vale para", escolha toda a instituição, uma unidade, uma área ou um serviço.',
            pode.acessos &&
              'Acessos em lote: "Cadastrar em lote" recebe uma lista copiada da planilha com Nome, E-mail, Perfil (opcional, padrão Funcionário) e Vale para (opcional: unidade, área ou serviço). Confira a prévia: quem já tem acesso só ganha o perfil, acesso desativado é reativado e as linhas com problema ficam de fora.',
            pode.organizacao &&
              'Estrutura das planilhas: a Administração da rede cria as planilhas na pasta da instituição e roda "Preparar estrutura" (abas, colunas, perfis e permissões) depois de cada atualização do Elo; por isso a tela Estrutura não aparece no menu. Se o Elo avisar que há atualização esperando, peça a ela; depois, quem estiver usando deve sair e entrar de novo. Nada é apagado.',
            pode.organizacao &&
              'Fotos e vídeos das requisições: ficam numa pasta de uma unidade compartilhada do Drive da instituição, com a conta de serviço do Elo como Gerente de conteúdo. O Elo cria essa pasta sozinho dentro da pasta da instituição, quando a Administração da rede prepara a estrutura.',
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
            [
              'Não vejo um item no menu.',
              'O menu mostra só o que o seu perfil permite. Peça à Administração da plataforma para conferir o seu perfil. Logo depois de uma atualização do Elo, pode faltar rodar "Preparar estrutura": a Administração recebe esse aviso.',
            ],
            ['Diz que o registro foi alterado por outra pessoa.', 'Outra pessoa salvou primeiro. Recarregue a tela, confira e faça a sua alteração de novo.'],
            [
              'Não consigo aprovar o exercício.',
              'O botão só libera sem fonte "a definir" e sem proposta aguardando decisão. A Previsão do ano mostra o que falta.',
            ],
            ['Um funcionário não aparece em nenhum serviço.', 'A lotação dele não soma 100%. Corrija em Folha de pagamento › Lotação.'],
          ].map(([p, r]) => (
            <div key={p}>
              <dt className="font-semibold">{p}</dt>
              <dd className="text-texto-suave">{r}</dd>
            </div>
          ))}
        </dl>
        <Sub>Encarregado de dados (LGPD)</Sub>
        {encarregado ? (
          <p>
            {encarregado.nome} ·{' '}
            <a href={`mailto:${encarregado.email}`} className="underline">
              {encarregado.email}
            </a>
          </p>
        ) : (
          <p>
            A instituição ainda não indicou o encarregado de dados.{' '}
            {pode.dpo && (
              <Link href="/admin/encarregado" className="underline">
                Cadastrar
              </Link>
            )}
          </p>
        )}
        {pode.dpo && (
          <p className="mt-2 text-texto-suave">
            Para cadastrar, corrigir ou trocar o encarregado, use Administração › Encarregado de dados. Ao trocar, o anterior fica no histórico.
          </p>
        )}
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
      <section
        aria-label="Manual completo"
        className="flex flex-wrap items-center justify-between gap-4 rounded-cartao border border-borda bg-superficie px-5 py-4"
      >
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
          <details key={s.id} id={s.id} open={i === 0} className="group scroll-mt-20 rounded-cartao border border-borda bg-superficie">
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
