import Link from 'next/link';
import type { ReactNode } from 'react';
import type { Autorizador } from '@/nucleo/acesso/autorizador';
import { PERFIS_INICIAIS, PERMISSOES_INICIAIS } from '@/nucleo/estrutura/dados-iniciais';
import { navegacaoDoUsuario } from '@/plataforma/navegacao';
import { ESTRUTURA_DOS_MODULOS } from '@/plataforma/registro-modulos';
import type { GrupoNavegacao, ItemNavegacao } from '@/ui/casca';
import { NOME_PLATAFORMA, textoVersao } from '@/ui/marca';

/**
 * Assuntos da Ajuda: fonte única do passo a passo (ADR-040). A Ajuda mostra só os do perfil de quem
 * está vendo; o manual completo (`/ajuda/manual`) mostra todos, cada um com "Para: <perfis>".
 */
export interface Assunto {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: ReactNode;
  atalhos?: { rotulo: string; href: string }[];
  /** Permissões (qualquer uma) que dão acesso à tela; vazio = vale para todos os perfis. */
  permissoes?: string[];
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

type Verificador = Pick<Autorizador, 'temPermissao' | 'temPermissaoAlgumEscopo'>;

/** O que a pessoa pode fazer; `todos` liga tudo (manual completo). */
export function calcularPode(v: Verificador, todos = false) {
  const decide = v.temPermissao('orcamento.previsao.editar');
  return {
    decide,
    aprova: v.temPermissao('orcamento.exercicio.aprovar'),
    // O Financeiro também tem "propor", mas usa as telas de lançamento e decisão.
    propor: todos || (v.temPermissaoAlgumEscopo('orcamento.previsao.propor') && !decide),
    cotar: v.temPermissao('orcamento.previsao.cotar'),
    paineis: v.temPermissao('orcamento.painel.ver') || decide,
    folhaResumo: v.temPermissaoAlgumEscopo('orcamento.folha.ver'),
    folhaCompleta: v.temPermissao('orcamento.folha.ver_individual'),
    folhaEditar: v.temPermissao('orcamento.folha.editar'),
    parametros: v.temPermissao('orcamento.parametros.editar'),
    organizacao: v.temPermissao('core.organizacao.gerenciar'),
    acessos: v.temPermissao('core.acessos.gerenciar'),
    requisitar: v.temPermissaoAlgumEscopo('requisicoes.solicitar'),
    aprovarRequisicao: v.temPermissaoAlgumEscopo('requisicoes.aprovar'),
    atenderRequisicao: v.temPermissaoAlgumEscopo('requisicoes.atender'),
    painelRequisicoes: v.temPermissaoAlgumEscopo('requisicoes.painel'),
    decidirEspacos: v.temPermissaoAlgumEscopo('requisicoes.espacos.decidir'),
    operarVeiculos: v.temPermissaoAlgumEscopo('requisicoes.veiculos.operar'),
    avaliar: v.temPermissaoAlgumEscopo('avaliacao.avaliar'),
    painelAvaliacao: v.temPermissaoAlgumEscopo('avaliacao.painel'),
    avaliarEducacao: v.temPermissaoAlgumEscopo('educacao.avaliar'),
    avaliarSaude: v.temPermissaoAlgumEscopo('saude.avaliar'),
    tiposRequisicao: v.temPermissao('requisicoes.tipos.gerenciar'),
    veiculos: v.temPermissao('requisicoes.veiculos.cadastrar'),
    dpo: v.temPermissao('core.dpo.gerenciar'),
    projetos: v.temPermissaoAlgumEscopo('projetos.acessar'),
    decidirProjeto: v.temPermissao('projetos.decidir') || v.temPermissaoAlgumEscopo('projetos.decidir_alcada'),
    gerenciarProjeto: v.temPermissaoAlgumEscopo('projetos.gerenciar'),
    termos: v.temPermissaoAlgumEscopo('parcerias.termos.ver'),
    verPlanejamento: v.temPermissaoAlgumEscopo('projetos.acessar'),
    planejarProjeto: v.temPermissaoAlgumEscopo('projetos.gerenciar'),
    decidirPlano: v.temPermissao('projetos.decidir'),
    ler: v.temPermissaoAlgumEscopo('conhecimento.ler'),
    publicar: v.temPermissao('conhecimento.publicar'),
    acompanharConhecimento: v.temPermissao('conhecimento.acompanhar'),
    categoriasConhecimento: v.temPermissao('conhecimento.categorias.gerenciar'),
    gerenciarProjetos: v.temPermissaoAlgumEscopo('projetos.gerenciar'),
    comunicacao: v.temPermissaoAlgumEscopo('comunicacao.solicitar') || v.temPermissao('comunicacao.revisar'),
    equipeComunicacao: v.temPermissao('comunicacao.revisar'),
    configurarComunicacao: v.temPermissao('comunicacao.configurar'),
    resultadoInstagram: v.temPermissao('comunicacao.revisar'),
    aprovarComunicacao: v.temPermissao('comunicacao.aprovar'),
    indicadoresComunicacao: v.temPermissao('comunicacao.indicadores'),
    pessoas: v.temPermissaoAlgumEscopo('core.pessoas.ver'),
    editarPessoas: v.temPermissaoAlgumEscopo('core.pessoas.editar'),
    indicadores: v.temPermissao('plataforma.indicadores.ver'),
    servicos: v.temPermissaoAlgumEscopo('plataforma.servicos.ver'),
    feriados: v.temPermissao('core.feriados.gerenciar'),
  };
}
export type Pode = ReturnType<typeof calcularPode>;

const todasAsPermissoes = () => new Set([...PERMISSOES_INICIAIS, ...(ESTRUTURA_DOS_MODULOS.permissoes ?? [])].map((x) => x.permissao));

/** Quem tem tudo: monta o manual completo e o menu inteiro. */
export function autorizadorTotal(): Autorizador {
  const todas = todasAsPermissoes();
  return { permissoes: () => todas, temPermissao: () => true, temPermissaoAlgumEscopo: () => true } as unknown as Autorizador;
}

/** Nomes dos perfis que têm alguma das permissões (calculado, nunca digitado). Vazio = todos. */
export function perfisPara(permissoes: string[] | undefined): string[] {
  if (!permissoes?.length) return [];
  const retiradas = new Set(ESTRUTURA_DOS_MODULOS.permissoesRetiradas?.map((x) => `${x.perfil}|${x.permissao}`));
  const pares = [...PERMISSOES_INICIAIS, ...(ESTRUTURA_DOS_MODULOS.permissoes ?? [])].filter((x) => !retiradas.has(`${x.perfil}|${x.permissao}`));
  const nomes = new Map([...PERFIS_INICIAIS, ...(ESTRUTURA_DOS_MODULOS.perfis ?? [])].map((p) => [p.codigo, p.nome]));
  const codigos = new Set(pares.filter((x) => permissoes.includes(x.permissao)).map((x) => x.perfil));
  return [...nomes].filter(([c]) => codigos.has(c)).map(([, n]) => n);
}

export function textoPara(a: Assunto): string {
  const p = perfisPara(a.permissoes);
  return p.length ? p.join(', ') : 'todos os perfis';
}

export function montarAssuntos(ctx: {
  pode: Pode;
  instituicao: { nome: string };
  encarregado: { nome: string; email: string } | null;
}): Assunto[] {
  const { pode, instituicao, encarregado } = ctx;
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
      permissoes: ['requisicoes.solicitar'],
      titulo: 'Requisições',
      resumo: 'Pedir materiais ao Almoxarifado, abrir chamados de TI e pedir mudança ou empréstimo de móveis; aprovar e atender, com histórico e prazos.',
      atalhos: [
        { rotulo: 'Nova requisição', href: '/requisicoes/nova' },
        ...(pode.aprovarRequisicao ? [{ rotulo: 'Para aprovar', href: '/requisicoes/aprovar' }] : []),
        ...(pode.atenderRequisicao ? [{ rotulo: 'Para atender', href: '/requisicoes/atender' }] : []),
        ...(pode.decidirEspacos ? [{ rotulo: 'Reservas de espaço', href: '/requisicoes/espacos' }] : []),
        ...(pode.operarVeiculos
          ? [
              { rotulo: 'Pedidos de veículo', href: '/requisicoes/veiculos/pedidos' },
              { rotulo: 'Agenda dos veículos', href: '/requisicoes/veiculos/agenda' },
            ]
          : []),
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
          <Sub>Reservar um espaço</Sub>
          <Passos
            itens={[
              'Abra Requisições › Nova requisição e escolha o tipo "Reserva de espaço".',
              'Preencha a data e as horas de início e de fim. A lista de espaços mostra só os que estão livres naquela data, com a capacidade ao lado.',
              'Informe quantas pessoas são esperadas e a finalidade. Se passar da capacidade, aparece um aviso, mas dá para enviar.',
              'Marque se é uma cessão para fora da instituição. Se não for, escolha os centros de custo (somando 100%); se for, informe a organização ou pessoa e não há centro de custo.',
              'Clique em Enviar pedido. O setor Espaços aprova, devolve para ajuste ou recusa; você acompanha em Minhas requisições. Enquanto não for aprovada, dá para cancelar. O pedido não é barrado por outro no mesmo horário: quem decide vê o conflito.',
            ]}
          />
          <Sub>Pedir um veículo</Sub>
          <Passos
            itens={[
              'Abra Requisições › Nova requisição e escolha o tipo "Uso de veículo".',
              'Escolha a área e os centros de custo (um ou mais serviços, somando 100%). Eles servem só para saber depois quais serviços mais usam os veículos: não geram despesa.',
              'Informe a saída e a volta prevista (dia/mês/ano e hora; a volta pode ser em outro dia) e depois escolha o veículo. Veículos em manutenção nessas datas não aparecem na lista.',
              'Preencha destino, finalidade (para que será usado) e condutor, que já vem com o seu nome: troque se outra pessoa for dirigir.',
              'Clique em Enviar pedido. Se já houver pedido no mesmo horário, aparece um aviso, mas dá para enviar: o Transporte decide. Enquanto não for aprovado, você pode ajustar (se devolvido) ou cancelar em Minhas requisições.',
            ]}
          />
          <Sub>Quem aprova</Sub>
          <Itens
            itens={[
              'A coordenação dos centros de custo. Uma requisição não pode misturar serviços de coordenações diferentes: abra uma para cada.',
              'Pedido feito pela própria coordenação, ou de serviço sem coordenação cadastrada, é aprovado pela Diretoria.',
              'Reserva de espaço é sempre decidida pelo setor Espaços, de qualquer coordenação. Se quem pede é do próprio setor Espaços, a Diretoria decide.',
              'Pedido de veículo é sempre decidido pelo Transporte, de qualquer coordenação. Se quem pede é do Transporte, a Diretoria decide.',
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
          {pode.decidirEspacos && (
            <>
              <Sub>Decidir reservas de espaço</Sub>
              <Passos
                itens={[
                  'Abra Requisições › Reservas de espaço: "Para aprovar" lista os pedidos novos e "Para fechar" as reservas aprovadas cuja hora de fim já passou.',
                  'Na ficha, o bloco "Conflitos neste horário" mostra quem pediu o mesmo espaço em horário que se cruza (encostar, como 10h–11h e 11h–12h, não conta). Clique em Aprovar reserva, Devolver para ajuste ou Recusar (os dois últimos pedem o motivo).',
                  'Se o horário já está aprovado para outro pedido, o sistema pede confirmação antes de aprovar. A decisão não tem volta.',
                  'Depois do uso, abra a ficha e clique em Registrar uso: "Usado sem problema" ou "Usado com problema" (este pede o texto). O botão só libera depois da hora de fim.',
                ]}
              />
            </>
          )}
          {pode.operarVeiculos && (
            <>
              <Sub>Decidir pedidos de veículo</Sub>
              <Passos
                itens={[
                  'Abra Requisições › Pedidos de veículo: a lista traz os pedidos novos pela ordem de saída, com os selos "Conflito" (outro pedido no mesmo veículo e horário) e "Manutenção" (a manutenção prevista atinge o período).',
                  'Na ficha, o quadro "Pedidos neste horário" mostra quem pediu, o destino e a situação de cada pedido que cruza (encostar, como a volta às 12h e a saída às 12h, não conta). Clique em Aprovar pedido, Devolver para ajuste ou Recusar (os dois últimos pedem o motivo).',
                  'Se já existe um pedido aprovado no mesmo horário, o sistema pede confirmação antes de aprovar; a confirmação fica no histórico. Se o outro ainda está aguardando, aprova direto.',
                  'Para resolver um conflito ou o aviso de manutenção de um pedido já aprovado, abra a ficha e clique em Cancelar reserva (o motivo é obrigatório e quem pediu vê no histórico). Nada é cancelado sozinho.',
                  'Em Agenda dos veículos, veja por veículo os pedidos dos próximos 30 dias e a manutenção prevista; ali também dá para marcar a manutenção como feita.',
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
              <Sub>Espaços para reservar</Sub>
              <p>
                Em Requisições › Espaços (só a Administração da plataforma), cadastre cada espaço com nome, local e capacidade. Em cada espaço, &ldquo;Adicionar
                período&rdquo; marca as datas em que ele não pode ser reservado (reforma, obra): nessas datas ele some da lista de quem pede. Encerrar um espaço ou um
                período não apaga nada. Para liberar os pedidos, cadastre também o tipo &ldquo;Reserva de espaço&rdquo; em Tipos de requisição, com a ficha de reserva
                e o setor Espaços; atribua o perfil Setor de Espaços às pessoas do setor em Acessos.
              </p>
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
          {pode.veiculos && (
            <>
              <Sub>Veículos</Sub>
              <p>
                Em Requisições › Veículos (só a Administração da plataforma), cadastre cada veículo da instituição com nome, placa e capacidade de passageiros.
                Ao alterar um veículo, informe a data da próxima manutenção: a partir desse dia ele deixa de aparecer para pedido novo, até você clicar em
                &ldquo;Marcar feita&rdquo; (e, se já souber, informar a data da seguinte). Veículo excluído some da lista de pedido, mas pode ser reativado
                em &ldquo;Veículos excluídos&rdquo;. Nada é apagado.
                Para liberar os pedidos, cadastre o tipo &ldquo;Uso de veículo&rdquo; em Tipos de requisição, com a ficha de veículo e o setor Transporte, e atribua o
                perfil Transporte às pessoas do setor em Acessos. O tipo de veículo não aceita foto nem vídeo.
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
      permissoes: ['avaliacao.avaliar', 'avaliacao.painel'],
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
                  'Na seção Quem e quando, identifique a pessoa só pelas iniciais, data de nascimento e sexo. O prontuário é opcional e o nome completo não é pedido.',
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

  if (pode.avaliarEducacao) {
    assuntos.push({
      id: 'educacao',
      permissoes: ['educacao.avaliar'],
      titulo: 'Educação',
      resumo: 'Ver os instrumentos de avaliação de Educação e aplicar um a uma pessoa.',
      atalhos: [
        { rotulo: 'Instrumentos', href: '/educacao/instrumentos' },
        { rotulo: 'Nova avaliação', href: '/educacao/nova' },
      ],
      conteudo: (
        <>
          <Sub>Instrumentos</Sub>
          <Passos
            itens={[
              'Abra Avaliações › Educação › Instrumentos. A tela lista os três instrumentos, com a versão e o número de domínios e itens.',
              'Clique em Aplicar a uma pessoa: a nova avaliação abre com o instrumento já escolhido. Na seção Quem e quando, escolha a pessoa (a busca filtra pelo nome), o serviço e o período.',
              'Clique em Sobre o instrumento para ler como o total, os subtotais e as faixas são calculados.',
            ]}
          />
        </>
      ),
    });
  }

  if (pode.avaliarSaude) {
    assuntos.push({
      id: 'saude',
      permissoes: ['saude.avaliar'],
      titulo: 'Saúde',
      resumo: 'Ver o instrumento de avaliação de Saúde, na versão em uso, e aplicar a uma pessoa.',
      atalhos: [
        { rotulo: 'Instrumentos', href: '/saude/instrumentos' },
        { rotulo: 'Nova avaliação', href: '/saude/nova' },
      ],
      conteudo: (
        <>
          <Sub>Instrumentos</Sub>
          <Passos
            itens={[
              'Abra Avaliações › Saúde › Instrumentos. A tela mostra o instrumento do CER na versão em uso.',
              'Clique em Aplicar a uma pessoa para abrir a nova avaliação, ou em Sobre o instrumento para ler como o total e as faixas são calculados.',
            ]}
          />
        </>
      ),
    });
  }

  if (pode.resultadoInstagram || pode.indicadoresComunicacao) {
    assuntos.push({
      id: 'resultado-instagram',
      permissoes: ['comunicacao.revisar', 'comunicacao.indicadores'],
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
      permissoes: ['orcamento.previsao.propor'],
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
      permissoes: ['orcamento.previsao.cotar'],
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
      permissoes: ['orcamento.previsao.editar', 'orcamento.exercicio.aprovar'],
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
                  'Ao lançar uma despesa (e ao informar o realizado de uma despesa), escolha, se quiser, o Item contábil e a Área do plano. A lista mostra primeiro os itens habilitados no plano do ano e, abaixo, "Outros itens do grupo". Se a escolha estiver fora do plano, aparece um aviso amarelo e você pode salvar mesmo assim. O Elo nunca preenche esses campos sozinho. Um item de outro grupo não é aceito.',
                  'Para ver o que mudou entre dois anos, use Comparar exercícios (botão na tela do plano): escolha os dois anos e veja o que entrou, o que saiu e o que mudou de grupo, usando o plano que valia no fim de cada ano. É só leitura.',
                  'Divergências de área (botão na tela do plano): mostra as despesas lançadas com Área do plano diferente da área do serviço, com o total por par de áreas e a lista dos lançamentos. Lançamento sem área do plano não conta como divergência; aparece só como aviso. Coordenação vê só os seus serviços; Leitura vê só os totais.',
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
      permissoes: ['orcamento.painel.ver', 'orcamento.previsao.editar'],
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
      permissoes: ['orcamento.folha.ver'],
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

  if (pode.verPlanejamento) {
    assuntos.push({
      id: 'projetos-planejamento',
      permissoes: ['projetos.acessar'],
      titulo: 'Projetos: atividades e orçamento (fase 3)',
      resumo: 'Planejar o que será feito, por quem e até quando, e quanto vai custar, antes de iniciar a implementação.',
      atalhos: [{ rotulo: 'Projetos', href: '/projetos' }],
      conteudo: (
        <>
          <Itens
            itens={[
              'Depois que a Diretoria aprova o Termo de Abertura, o projeto entra na fase 3. A ficha do projeto mostra "O que falta para a próxima porta".',
              'As abas Atividades e Orçamento mostram o plano em leitura para quem vê o projeto. Quem está só na equipe vê as atividades, mas não o orçamento.',
              'Atividade que passou do fim previsto sem ser concluída aparece como "Atrasada" (a palavra vem junto da cor).',
              'O orçamento do projeto é só o plano do projeto: ele não é enviado ao Orçamento da instituição.',
            ]}
          />
          {pode.planejarProjeto && (
            <>
              <Sub>Cadastrar as atividades</Sub>
              <Passos
                itens={[
                  'Abra o projeto e a aba Atividades.',
                  'Em Adicionar atividade, escreva o que será feito, o e-mail de quem é responsável (a pessoa precisa ter acesso ao Elo) e as datas previstas de início e fim. O peso é opcional.',
                  'Para acompanhar, escolha a situação na própria linha. Para concluir, informe a data em que a atividade terminou.',
                  'Retirar não apaga: a atividade sai da lista e fica guardada.',
                ]}
              />
              <Sub>Montar o orçamento do projeto</Sub>
              <Passos
                itens={[
                  'Abra a aba Orçamento e use Adicionar linha: categoria, descrição, valor planejado e, se quiser, de onde vem o dinheiro.',
                  'O total aparece no alto, com o valor aprovado no Termo ao lado para comparar. Se forem diferentes, a tela só avisa; nada é bloqueado.',
                  'O orçamento só muda na fase 3. Depois, mudanças passam por pedido de mudança.',
                ]}
              />
              <Sub>Seguir para a implementação</Sub>
              <Passos
                itens={[
                  'Com atividades e orçamento prontos (e, no porte completo, os demais documentos da fase), a ficha mostra o botão da próxima etapa.',
                  'Porte completo: Abrir porta de decisão (porta 3, do plano). Porte enxuto: Iniciar a implementação, sem porta.',
                  'Sem Termo de Abertura aprovado, o projeto não entra em implementação.',
                ]}
              />
            </>
          )}
          {pode.decidirPlano && <p className="mt-3">Na porta 3, a Diretoria decide seguir, ajustar ou parar, com justificativa, depois dos pareceres, como nas portas anteriores.</p>}
        </>
      ),
    });
  }

  if (pode.verPlanejamento) {
    assuntos.push({
      id: 'projetos-implementacao',
      permissoes: ['projetos.acessar'],
      titulo: 'Projetos: problemas, mudanças e relatórios (implementação)',
      resumo: 'Acompanhar o projeto depois do início: registrar o que deu errado, pedir mudança de prazo, custo ou escopo e enviar relatórios.',
      atalhos: [{ rotulo: 'Projetos', href: '/projetos' }],
      conteudo: (
        <>
          <Itens
            itens={[
              'Estas abas só funcionam com o projeto em implementação, isto é, com o Termo de Abertura aprovado. Antes disso, aparecem em leitura.',
              'Riscos e problemas: risco é o que pode dar errado; problema é o que já deu. Problema aberto continua na carteira até ter solução e data. Gravidade alta aparece em destaque.',
              'Quem está só na equipe do projeto vê riscos e problemas, mas não vê pedidos de mudança, relatórios nem o orçamento.',
              'A situação do relatório vem sempre com a palavra (Verde, Amarelo ou Vermelho), nunca só com a cor.',
            ]}
          />
          {pode.planejarProjeto && (
            <>
              <Sub>Registrar um problema</Sub>
              <Passos
                itens={[
                  'Abra o projeto e a aba Riscos e problemas.',
                  'Em Registrar problema, descreva o que aconteceu, escolha a gravidade e, se quiser, quem cuida da solução.',
                  'Quando resolver, use Registrar solução: escreva como foi resolvido e a data. Nada é apagado.',
                ]}
              />
              <Sub>Pedir uma mudança</Sub>
              <Passos
                itens={[
                  'Abra a aba Mudanças e clique em Pedir mudança. Escolha prazo, custo ou escopo.',
                  'Preencha o que muda e o motivo e clique em Conferir a tolerância. O Elo mostra em palavras a variação (por exemplo, “a linha sobe 5% de 10% permitidos”) e diz quem decide.',
                  'Dentro da tolerância do Termo de Abertura, você aplica na hora e fica no histórico. Fora dela, o pedido vai para a Diretoria e nada muda até a decisão.',
                  'A comparação é feita com a última versão aprovada do Termo: várias mudanças pequenas somam e podem passar do limite.',
                  'Mudança de escopo sempre vai para a Diretoria, a não ser que o Termo tenha declarado um “escopo livre” e você marque que a mudança cabe nele.',
                ]}
              />
              <Sub>Enviar um relatório</Sub>
              <Passos
                itens={[
                  'Abra a aba Relatórios e preencha o período, o que aconteceu e, se quiser, quanto já foi gasto.',
                  'O Elo compara planejado e realizado, conta atividades atrasadas e problemas abertos e calcula a situação geral. Você só pode escolher uma situação pior que a calculada, explicando o motivo.',
                  'Se o projeto usa números do cadastro nos indicadores, o relatório também registra a medição do dia.',
                ]}
              />
            </>
          )}
          {pode.decidirProjeto && (
            <p className="mt-3">
              Pedido fora da tolerância aparece em “Espera uma ação sua”, na tela inicial de Projetos. A Diretoria aprova ou recusa, sempre com justificativa. Aprovado, o Elo aplica a mudança e gera uma nova versão do Termo de Abertura (a anterior fica guardada como substituída). Se o novo valor total passar do limite de alçada, a aprovação da Diretoria segue para a Presidência ou o Conselho. Quem fez o pedido não decide o próprio pedido.
            </p>
          )}
        </>
      ),
    });
  }

  if (pode.verPlanejamento) {
    assuntos.push({
      id: 'projetos-encerramento',
      permissoes: ['projetos.acessar'],
      titulo: 'Projetos: encerramento e lições aprendidas',
      resumo: 'Fechar o projeto com check-list, relatório final e lições, e consultar o que outros projetos ensinaram.',
      atalhos: [{ rotulo: 'Projetos', href: '/projetos' }, { rotulo: 'Lições aprendidas', href: '/projetos/licoes' }],
      conteudo: (
        <>
          <Itens
            itens={[
              'O projeto só encerra com todas as atividades concluídas ou canceladas, os problemas resolvidos, o check-list completo, o relatório final e ao menos uma lição aprendida. A tela “O que falta” diz o que ainda não está pronto.',
              'Depois que a Diretoria aceita o encerramento, o projeto passa a somente leitura.',
              'Projeto parado ou cancelado também registra um relatório resumido e lições.',
              'Quem aparece como atrasado: projeto em implementação com o fim previsto vencido, ou em encerramento há mais de 30 dias.',
              'A consulta de lições (botão “Lições aprendidas”, na tela inicial de Projetos) é aberta a todos que acessam o app. Quem não acompanha o projeto vê a lição, sem o nome do projeto.',
            ]}
          />
          {pode.planejarProjeto && (
            <>
              <Sub>Encerrar um projeto</Sub>
              <Passos
                itens={[
                  'Abra o projeto, a aba Encerramento e lições e clique em Iniciar o encerramento.',
                  'Marque cada item do check-list (contratual, financeiro e administrativo) quando estiver feito.',
                  'Escreva o relatório final. Transição e sustentabilidade são opcionais.',
                  'Registre pelo menos uma lição: categoria, o que aconteceu e o que fazer diferente.',
                  'Com tudo pronto, clique em Abrir porta de encerramento. Depois de aberta, o check-list e o relatório ficam travados até a decisão.',
                ]}
              />
            </>
          )}
          {pode.decidirProjeto && <p className="mt-3">Na porta de encerramento, a Diretoria escolhe aceitar (o projeto encerra), ajustar (volta a ser editado na fase 5) ou parar (volta à implementação), sempre com justificativa. Essa porta não pede parecer.</p>}
        </>
      ),
    });
  }

  if (pode.projetos) {
    assuntos.push({
      id: 'projetos-termo',
      permissoes: ['projetos.acessar'],
      titulo: 'Projeto financiado: termo de parceria',
      resumo: 'O que informar no Termo de Abertura e o que acontece quando a porta 2 aprova.',
      atalhos: [{ rotulo: 'Projetos', href: '/projetos' }, ...(pode.termos ? [{ rotulo: 'Termos de parceria', href: '/parcerias' }] : [])],
      conteudo: (
        <>
          <Itens
            itens={[
              pode.gerenciarProjeto && 'No Termo de Abertura de um projeto com financiamento externo, informe quem financia e o que o financiamento cobre (objeto). Sem os dois, a porta 2 não abre; a tela diz o que falta.',
              pode.decidirProjeto && 'Ao seguir na porta 2 de um projeto financiado, o Elo cria sozinho o rascunho do termo em Parcerias, uma vez só, com financiador, objeto, serviço, vigência prevista e o valor aprovado.',
              'O número do termo, o tipo de instrumento e o cronograma ficam para o Financeiro completar; ninguém digita de novo o que já está no projeto.',
              'Se o rascunho não puder ser criado, a decisão da porta continua valendo.',
              'O rascunho não entra no orçamento, na ocupação nem nos alertas de Parcerias até o Financeiro concluir o termo.',
              pode.termos && 'Em Termos de parceria, o quadro "Rascunhos para completar" lista o que veio de projetos.',
            ]}
          />
          {pode.gerenciarProjeto && (
            <>
              <Sub>Refazer o rascunho do termo</Sub>
              <Passos
                itens={[
                  'Abra o projeto e entre na aba Ligações.',
                  'Se aparecer "Este projeto ainda não tem termo", clique em Criar rascunho do termo.',
                  'Clicar de novo não duplica: o Elo reaproveita o rascunho que já existe.',
                ]}
              />
            </>
          )}
          <Sub>Outras ligações e compras</Sub>
          <p>
            Na aba Ligações, &quot;Outras ligações&quot; lista o que o projeto tem em comum com outros apps (o nome é uma cópia guardada no projeto) e &quot;Compras do projeto&quot; mostra as requisições ligadas a ele. Se o app não
            estiver ativo, aparece &quot;Ligação indisponível&quot; e o resto da tela continua funcionando. Os detalhes só aparecem para quem tem acesso ao app onde o dado fica.
          </p>
          <Sub>Valores diferentes</Sub>
          <p>Se o valor aprovado do projeto for diferente do valor do termo, a aba Ligações mostra um aviso. É só informação: o projeto não altera o termo.</p>
        </>
      ),
    });
  }

  if (pode.ler) {
    assuntos.push({
      id: 'conhecimento',
      permissoes: ['conhecimento.ler'],
      titulo: 'Base de Conhecimento',
      resumo: 'Ler comunicados e normas, dar ciência e ver o que falta; para quem publica, criar publicações e acompanhar quem está em dia.',
      atalhos: [
        { rotulo: 'Biblioteca', href: '/conhecimento' },
        { rotulo: 'Meus documentos', href: '/conhecimento/meus-documentos' },
        ...(pode.publicar ? [{ rotulo: 'Nova publicação', href: '/conhecimento/publicacoes/nova' }] : []),
        ...(pode.acompanharConhecimento ? [{ rotulo: 'Acompanhamento', href: '/conhecimento/acompanhamento' }] : []),
        ...(pode.categoriasConhecimento ? [{ rotulo: 'Categorias', href: '/conhecimento/categorias' }] : []),
      ],
      conteudo: (
        <>
          <Sub>Ler e dar ciência</Sub>
          <Passos
            itens={[
              'Abra Base de Conhecimento. No alto, "Falta você" lista os documentos que pedem a sua ciência; a tela inicial também avisa.',
              'Clique em Abrir. Leia o texto e, se houver, abra o PDF ou a imagem anexada.',
              'No cartão "O que falta", clique em "Li e estou de acordo" e confirme. Isso registra o seu nome, a data e a hora e não dá para desfazer.',
              'Se a publicação tem teste de compreensão, ele aparece abaixo do cartão "O que falta": marque uma opção em cada pergunta e clique em "Enviar respostas". Você precisa acertar todas.',
              'Se errar, a tela diz quantas acertou e quais perguntas revisar, sem mostrar a resposta certa. Clique em "Tentar de novo" quantas vezes precisar; errar não avisa ninguém.',
              'Quando a publicação exige teste e ciência, o botão "Li e estou de acordo" só é liberado depois de você acertar o teste.',
              'Se o conteúdo ou o teste mudar numa versão nova, o documento volta a ficar pendente e você refaz o que for pedido.',
              'Em Meus documentos, veja o que já está em dia (com a data da ciência e do teste) e o que falta. Pendência com mais de 15 dias fica marcada como vencida.',
            ]}
          />
          <p className="mt-2">Você só vê as publicações do seu público (todos, um perfil ou uma área). Ninguém vê a ciência de outra pessoa, só quem acompanha.</p>
          {pode.publicar && (
            <>
              <Sub>Publicar</Sub>
              <Passos
                itens={[
                  'Abra Publicações › Nova publicação (se faltar categoria, cadastre em Categorias).',
                  'Preencha título, categoria e resumo; escreva o texto, envie um anexo (PDF até 10 MB ou imagem), ou os dois.',
                  'Em "Quem deve ler", escolha Todos, Um perfil ou Uma área. Marque "Exige ciência" se a pessoa precisa confirmar que leu.',
                  'Para pedir um teste, marque "Tem teste de compreensão" e cadastre de 1 a 10 perguntas, cada uma com 2 a 5 opções; marque em cada pergunta a opção certa (quem faz o teste não a vê). Publicação com teste precisa de ao menos uma pergunta.',
                  'Salve como rascunho para revisar (ninguém recebe pendência) ou clique em Publicar.',
                  'Ao editar o texto ou o teste de uma publicação que já tem ciências ou tentativas, escolha "Correção pequena" (as ciências e aprovações continuam valendo) ou "Nova versão" (todos dão ciência de novo). Título, resumo, categoria, público e anexo mudam sem nova ciência.',
                  'Arquivar tira a publicação das listas e das pendências, mas guarda o registro de quem deu ciência; dá para reativar.',
                ]}
              />
            </>
          )}
          {pode.acompanharConhecimento && (
            <>
              <Sub>Acompanhar quem está em dia</Sub>
              <Itens
                itens={[
                  'Acompanhamento lista as publicações que exigem ciência ou teste com "X de Y em dia". Clique em "Ver as pessoas" para ver quem deu ciência, a melhor tentativa de cada um no teste, quem precisa renovar e quem está pendente; os filtros separam cada grupo.',
                  'Abrir a lista de pessoas fica registrado na auditoria.',
                ]}
              />
            </>
          )}
          {pode.categoriasConhecimento && (
            <>
              <Sub>Categorias</Sub>
              <p>Em Categorias, adicione e desative categorias. Não dá para desativar uma categoria que ainda tem publicação (que não esteja arquivada); desativadas podem ser reativadas.</p>
            </>
          )}
        </>
      ),
    });
  }

  if (pode.projetos) {
    assuntos.push({
      id: 'projetos',
      permissoes: ['projetos.acessar'],
      titulo: 'Projetos',
      resumo: 'Ideias e projetos da instituição, do marco lógico aos indicadores que vêm do cadastro.',
      atalhos: [{ rotulo: 'Projetos', href: '/projetos' }],
      conteudo: (
        <>
          <Sub>Indicadores do marco lógico</Sub>
          <Passos
            itens={[
              'Abra o projeto e a aba Marco lógico. No alto aparece o bloco Indicadores: cada indicador mostra a meta, o número de hoje e se está dentro ou abaixo da meta.',
              ...(pode.gerenciarProjetos
                ? [
                    'Em um item que já tem indicador, escolha De onde vem o número: pessoas com vínculo ativo no serviço, índice médio de necessidade de cuidado ou % de pessoas com reavaliação em dia. Depois escolha o serviço; cada escolha salva sozinha. Se preferir informar você mesmo, escolha Digitado à mão.',
                    'Para marcar a meta, digite o número (ex.: 80) e clique em Salvar meta.',
                    'Clique em Registrar medição para guardar os números de hoje no histórico do projeto. Cada medição é uma linha nova; as anteriores não mudam.',
                  ]
                : []),
              'Números sobre pessoas só aparecem quando há 5 pessoas ou mais. Com menos, o Elo mostra "Poucos casos para divulgar" e nunca o valor, para ninguém ser identificado. Nenhum nome ou dado individual vai para o projeto.',
              'Se o app Avaliação estiver desligado, o indicador mostra "Ligação indisponível" e vale o número digitado à mão, se houver.',
            ]}
          />
        </>
      ),
    });
  }

  if (pode.comunicacao) {
    assuntos.push({
      id: 'comunicacao-avisos',
      permissoes: ['comunicacao.solicitar', 'comunicacao.revisar'],
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
              pode.aprovarComunicacao && 'Pedido aguardando aprovação: a coordenação da Comunicação recebe o aviso para decidir.',
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

  assuntos.push({
    id: 'agenda-busca',
    titulo: 'Agenda e busca',
    resumo: 'Ver o que vence ou acontece em todos os apps e procurar um registro pelo nome.',
    atalhos: [
      { rotulo: 'Agenda', href: '/agenda' },
      { rotulo: 'Busca', href: '/busca' },
    ],
    conteudo: (
      <>
        <Sub>Agenda</Sub>
        <Passos
          itens={[
            'Abra Agenda. A tela junta prazos e datas dos apps que o seu perfil acessa: projetos, parcerias, comunicação, avaliação e requisições.',
            'Se houver itens vencidos, eles aparecem primeiro, com a etiqueta Vencido. Clique num item para abrir o registro e resolver.',
            'Use Lista ou Mês para mudar a visão; Anterior, Próximo e Hoje trocam o mês. No Mês, clique num dia para ver só o que cai nele.',
            'Para filtrar, escolha um app nos botões redondos ou um serviço na lista e clique em Aplicar. Limpar filtros volta ao todo.',
          ]}
        />
        <Sub>Busca</Sub>
        <Passos
          itens={[
            'Clique na lupa (ou campo) no alto da página, ou aperte a tecla / fora de um campo de texto, e digite pelo menos 2 letras.',
            'O resultado vem agrupado por tipo (projetos, termos, requisições, pedidos e pessoas) e mostra só o que o seu perfil já pode ver.',
            'Clique num resultado para abrir o registro. Sem resultado: tente menos letras ou outra grafia.',
          ]}
        />
      </>
    ),
  });

  if (pode.pessoas) {
    assuntos.push({
      id: 'pessoas',
      permissoes: ['core.pessoas.ver'],
      titulo: 'Pessoas',
      resumo: 'Cadastro único de atendidos, familiares e equipe: cadastrar, corrigir e vincular a um serviço.',
      atalhos: [{ rotulo: 'Pessoas', href: '/nucleo/pessoas' }],
      conteudo: (
        <>
          <Sub>Encontrar uma pessoa</Sub>
          <Passos
            itens={[
              'Abra Pessoas. A lista mostra só quem o seu perfil pode ver; quem não aparece está fora do seu escopo de acesso.',
              'Digite o nome em Buscar pelo nome (sem acento também vale) ou escolha um papel (Atendido, Familiar, Colaborador…) nos botões redondos.',
              'Clique em Abrir para ver os dados e os serviços da pessoa.',
            ]}
          />
          {pode.editarPessoas && (
            <>
              <Sub>Cadastrar</Sub>
              <Passos
                itens={[
                  'Clique em Cadastrar pessoa. Só o nome completo é obrigatório; CPF, NIS, contato e endereço ficam em Mais dados.',
                  'Escolha o papel e, se for atendido, o serviço e a data de entrada. Sem serviço, o atendido não aparece para avaliar.',
                  'Clique em Cadastrar e vincular. Se já existir alguém com o mesmo nome, o Elo avisa; se for outra pessoa mesmo, clique em É outra pessoa, cadastrar.',
                ]}
              />
              <Sub>Corrigir, vincular e encerrar</Sub>
              <Itens
                itens={[
                  'Em Corrigir dados, altere e clique em Salvar correção.',
                  'Em Vincular a serviço, escolha o serviço e a entrada (pode ser data passada) e clique em Vincular.',
                  'Encerrar vínculo pede o motivo e a data de saída. Nada é apagado: o histórico fica e a pessoa pode voltar com um novo vínculo.',
                ]}
              />
            </>
          )}
          <p className="mt-3 text-texto-suave">Abrir os dados de uma pessoa fica registrado (quem abriu e quando), porque são dados pessoais.</p>
        </>
      ),
    });
  }

  if (pode.indicadores) {
    assuntos.push({
      id: 'indicadores',
      permissoes: ['plataforma.indicadores.ver'],
      titulo: 'Indicadores',
      resumo: 'Os números dos apps num painel só, mês a mês.',
      atalhos: [{ rotulo: 'Indicadores', href: '/indicadores' }],
      conteudo: (
        <Passos
          itens={[
            'Abra Indicadores. No alto, números de destaque: requisições aprovadas no prazo, pedidos de comunicação no ano e resultado previsto do último exercício.',
            'Abaixo, um bloco por app (Requisições, Comunicação, Orçamento), com gráfico e tabela. Cada número diz se está dentro do esperado e compara com o período anterior.',
            'Para ver outro ano, escolha-o no seletor do alto da página.',
            'São os mesmos números que cada app mostra; aqui eles só são reunidos. Um bloco sem acesso ao app avisa isso, e um mês sem dado não vale zero.',
          ]}
        />
      ),
    });
  }

  if (pode.servicos) {
    assuntos.push({
      id: 'fichas-de-servico',
      permissoes: ['plataforma.servicos.ver'],
      titulo: 'Fichas de serviço',
      resumo: 'Tudo sobre um serviço numa tela: custo, vagas, projetos, requisições, publicações e avaliação.',
      atalhos: [{ rotulo: 'Fichas de serviço', href: '/servicos' }],
      conteudo: (
        <Passos
          itens={[
            'Abra Fichas de serviço e clique no nome do serviço. A lista mostra os serviços do seu escopo, com área, unidade, vagas e situação.',
            'A ficha abre com o resumo e números do serviço. Depois vêm os blocos: Custo e fontes, Vagas e atendidos, Projetos, Requisições, Publicações e Avaliação.',
            'Cada bloco segue a permissão do app dele: se você não acessa o app, o bloco não traz o dado. Vagas e avaliação mostram só quantidades, sem nomes.',
            'Use o link de cada bloco para abrir o app e ver o detalhe. Serviço encerrado mostra o histórico.',
          ]}
        />
      ),
    });
  }

  if (pode.organizacao || pode.acessos || pode.feriados || pode.dpo) {
    assuntos.push({
      id: 'administracao',
      permissoes: ['core.organizacao.gerenciar', 'core.acessos.gerenciar', 'core.feriados.gerenciar', 'core.dpo.gerenciar'],
      titulo: 'Administração',
      resumo: 'Serviços, áreas, acessos, feriados, encarregado de dados e estrutura das planilhas.',
      atalhos: [
        ...(pode.acessos ? [{ rotulo: 'Acessos', href: '/admin/acessos' }] : []),
        ...(pode.organizacao ? [{ rotulo: 'Áreas', href: '/admin/areas' }, { rotulo: 'Serviços', href: '/admin/servicos' }] : []),
        ...(pode.feriados ? [{ rotulo: 'Feriados', href: '/admin/feriados' }] : []),
        ...(pode.dpo ? [{ rotulo: 'Encarregado de dados', href: '/admin/encarregado' }] : []),
        ...(pode.organizacao ? [{ rotulo: 'Estrutura das planilhas', href: '/admin/estrutura' }] : []),
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
            pode.feriados &&
              'Feriados: dias que não contam como úteis nos prazos de Requisições e Comunicação. Em Incluir feriados, escolha o ano e clique em "Incluir feriados nacionais" (entra também o 9 de julho); para um feriado municipal ou ponto facultativo, informe a data e o nome e clique em "Incluir feriado". O ícone da lixeira tira um dia da lista, depois de confirmar.',
            pode.dpo &&
              'Encarregado de dados: quem a instituição indicou para a LGPD. Use "Cadastrar encarregado" (pessoa física ou jurídica, com documento e e-mail para onde os titulares escrevem), "Corrigir dados" para um erro de digitação e "Trocar encarregado" quando for outra pessoa: informe a data da troca e o anterior fica no histórico.',
            pode.organizacao &&
              'Estrutura das planilhas: a Administração da rede cria as planilhas na pasta da instituição e roda "Preparar estrutura" (abas, colunas, perfis e permissões) depois de cada atualização do Elo; por isso, com a rede, a tela Estrutura das planilhas não aparece no menu (em instituição sem rede, ela fica em Administração, com o botão Preparar estrutura). Se o Elo avisar que há atualização esperando, peça a ela; depois, quem estiver usando deve sair e entrar de novo. Nada é apagado.',
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

  return assuntos;
}

/** Todas as telas do menu completo, com o caminho em texto ("Apps › Orçamento › Previsão do ano"). */
export function telasDoMenu(grupos: GrupoNavegacao[]): { rotulo: string; href: string; caminho: string }[] {
  const saida: { rotulo: string; href: string; caminho: string }[] = [];
  const percorrer = (item: ItemNavegacao, trilha: string[]) => {
    const aqui = [...trilha, item.rotulo];
    saida.push({ rotulo: item.rotulo, href: item.href, caminho: aqui.join(' › ') });
    item.filhos?.forEach((f) => saida.push({ rotulo: f.rotulo, href: f.href, caminho: [...aqui, f.rotulo].join(' › ') }));
    item.apps?.forEach((x) => percorrer(x, aqui));
  };
  for (const g of grupos) g.itens.forEach((i) => percorrer(i, g.titulo ? [g.titulo] : []));
  return saida;
}

/** Menu de quem tem tudo; é a lista de telas que a Ajuda precisa cobrir. */
export const menuCompleto = () => navegacaoDoUsuario(autorizadorTotal(), false);

/** Caminho em texto de um atalho (ex.: "Apps › Orçamento › Previsão do ano"); o rótulo, se a tela não estiver no menu. */
export function caminhoDoAtalho(atalho: { rotulo: string; href: string }, telas = telasDoMenu(menuCompleto())): string {
  return telas.find((t) => t.href === atalho.href)?.caminho ?? atalho.rotulo;
}
