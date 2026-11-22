/** Regras puras das publicações da Base de Conhecimento (sem acesso a dados). */

export class ErroConhecimento extends Error {}

export const SITUACOES = ['rascunho', 'publicada', 'arquivada'] as const;
export type Situacao = (typeof SITUACOES)[number];

export const PUBLICOS = ['todos', 'perfil', 'area'] as const;
export type PublicoTipo = (typeof PUBLICOS)[number];

/** Dias, a partir do começo da edição atual, até a pendência ganhar a marca de vencida (fixo nesta entrega). */
export const DIAS_PARA_VENCER = 15;

export const LIMITES = {
  pdfBytes: 10 * 1024 * 1024,
  imagemBytes: 1_500_000,
  titulo: 150,
  resumo: 300,
  corpo: 20_000,
} as const;

export const mb = (bytes: number) => `${(bytes / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

const IMAGENS = ['image/jpeg', 'image/png', 'image/webp'];
export const tipoDoAnexo = (mime: string): 'pdf' | 'imagem' | null => {
  const m = mime.toLowerCase().split(';')[0].trim();
  if (m === 'application/pdf') return 'pdf';
  return IMAGENS.includes(m) ? 'imagem' : null;
};

/** Confere um arquivo antes de abrir o envio e antes de ligá-lo à publicação. */
export function conferirAnexo(a: { mime: string; tamanho: number }): string[] {
  const tipo = tipoDoAnexo(a.mime);
  if (!tipo) return ['Envie o anexo em PDF, JPG, PNG ou WebP.'];
  if (!(a.tamanho > 0)) return ['O arquivo está vazio.'];
  const limite = tipo === 'pdf' ? LIMITES.pdfBytes : LIMITES.imagemBytes;
  return a.tamanho > limite ? [`O arquivo tem ${mb(a.tamanho)}; o limite é ${mb(limite)}.`] : [];
}

export function extensaoDoMime(mime: string): string {
  const m = mime.toLowerCase().split(';')[0].trim();
  return m === 'application/pdf' ? 'pdf' : (m.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin');
}

export interface DadosParaConferir {
  titulo: string;
  categoria: string;
  resumo: string | null;
  corpo: string | null;
  temAnexo: boolean;
  publicoTipo: string;
  publicoValor: string | null;
}

/** Regra 2: título, categoria e público, mais texto ou anexo. Devolve as frases de erro. */
export function conferirPublicacao(d: DadosParaConferir, categoriasAtivas: ReadonlySet<string>): string[] {
  const erros: string[] = [];
  if (!d.titulo.trim()) erros.push('Informe o título.');
  else if (d.titulo.trim().length > LIMITES.titulo) erros.push(`O título passa de ${LIMITES.titulo} caracteres.`);
  if (!categoriasAtivas.has(d.categoria)) erros.push('Escolha uma categoria ativa.');
  if ((d.resumo ?? '').length > LIMITES.resumo) erros.push(`O resumo passa de ${LIMITES.resumo} caracteres.`);
  if ((d.corpo ?? '').length > LIMITES.corpo) erros.push(`O texto passa de ${LIMITES.corpo} caracteres.`);
  if (!(PUBLICOS as readonly string[]).includes(d.publicoTipo)) erros.push('Escolha quem deve ler.');
  else if (d.publicoTipo !== 'todos' && !(d.publicoValor ?? '').trim())
    erros.push(d.publicoTipo === 'perfil' ? 'Escolha o perfil que deve ler.' : 'Escolha a área que deve ler.');
  if (!(d.corpo ?? '').trim() && !d.temAnexo) erros.push('Escreva o texto ou envie um anexo (PDF ou imagem).');
  return erros;
}

export type SituacaoDaPessoa = 'sem_exigencia' | 'pendente' | 'precisa_renovar' | 'em_dia';

/** Teste de compreensão ligado à publicação (regras 11 e 12). */
export interface ExigenciaTeste {
  tem: boolean;
  edicoesAprovadas: readonly number[];
}

/**
 * Regras 8, 10 e 11: o que a pessoa cumpriu vale pela edição atual. Em dia = ciência (se exigida) e
 * aprovação no teste (se houver) na edição atual; algo cumprido só em edição anterior pede renovação.
 */
export function situacaoDaPessoa(
  exigeCiencia: boolean,
  edicaoAtual: number,
  edicoesComCiencia: readonly number[],
  teste: ExigenciaTeste = { tem: false, edicoesAprovadas: [] },
): SituacaoDaPessoa {
  if (!exigeCiencia && !teste.tem) return 'sem_exigencia';
  const cienciaOk = !exigeCiencia || edicoesComCiencia.includes(edicaoAtual);
  const testeOk = !teste.tem || teste.edicoesAprovadas.includes(edicaoAtual);
  if (cienciaOk && testeOk) return 'em_dia';
  const feitoAgora = (exigeCiencia && edicoesComCiencia.includes(edicaoAtual)) || (teste.tem && teste.edicoesAprovadas.includes(edicaoAtual));
  const feitoAntes = edicoesComCiencia.length > 0 || teste.edicoesAprovadas.length > 0;
  return !feitoAgora && feitoAntes ? 'precisa_renovar' : 'pendente';
}

export const TESTE = { maxPerguntas: 10, minOpcoes: 2, maxOpcoes: 5, textoPergunta: 300, textoOpcao: 200 } as const;

export interface PerguntaEntrada {
  texto: string;
  opcoes: string[];
  /** Posição (a partir de 0) da única opção certa. */
  correta: number;
}

/** Regra 12: de 1 a 10 perguntas, cada uma com 2 a 5 opções e exatamente uma correta. */
export function conferirPerguntas(perguntas: readonly PerguntaEntrada[], exigirAlguma: boolean): string[] {
  const erros: string[] = [];
  if (exigirAlguma && perguntas.length === 0) erros.push('Cadastre ao menos uma pergunta para o teste.');
  if (perguntas.length > TESTE.maxPerguntas) erros.push(`O teste pode ter até ${TESTE.maxPerguntas} perguntas.`);
  perguntas.forEach((q, i) => {
    const n = i + 1;
    if (!q.texto.trim()) erros.push(`Escreva o texto da pergunta ${n}.`);
    else if (q.texto.trim().length > TESTE.textoPergunta) erros.push(`A pergunta ${n} passa de ${TESTE.textoPergunta} caracteres.`);
    if (q.opcoes.length < TESTE.minOpcoes || q.opcoes.length > TESTE.maxOpcoes) erros.push(`A pergunta ${n} precisa de ${TESTE.minOpcoes} a ${TESTE.maxOpcoes} opções.`);
    else if (q.opcoes.some((o) => !o.trim())) erros.push(`Preencha todas as opções da pergunta ${n}.`);
    else if (q.opcoes.some((o) => o.trim().length > TESTE.textoOpcao)) erros.push(`Uma opção da pergunta ${n} passa de ${TESTE.textoOpcao} caracteres.`);
    if (!Number.isInteger(q.correta) || q.correta < 0 || q.correta >= q.opcoes.length) erros.push(`Marque a opção certa da pergunta ${n}.`);
  });
  return erros;
}

export interface ResultadoDoTeste {
  acertos: number;
  total: number;
  aprovada: boolean;
  /** Números (a partir de 1) das perguntas erradas; nunca a resposta certa (regra 13). */
  erradas: number[];
}

/** Regra 13: aprovada = todas certas. */
export function corrigirTeste(corretas: readonly number[], respostas: readonly number[]): ResultadoDoTeste {
  const erradas: number[] = [];
  corretas.forEach((c, i) => {
    if (respostas[i] !== c) erradas.push(i + 1);
  });
  return { acertos: corretas.length - erradas.length, total: corretas.length, aprovada: erradas.length === 0, erradas };
}

export const ROTULO_SITUACAO: Record<SituacaoDaPessoa, string> = {
  sem_exigencia: 'Sem exigência',
  pendente: 'Pendente',
  precisa_renovar: 'Precisa renovar',
  em_dia: 'Em dia',
};

const diaMs = 86_400_000;

/** Regra 20: pendência com mais de 15 dias, contados do começo da edição atual, está vencida. */
export function pendenciaVencida(edicaoEm: string, agora: Date): boolean {
  return agora.getTime() - new Date(edicaoEm).getTime() > DIAS_PARA_VENCER * diaMs;
}

/** Código de categoria a partir do nome (sem acento, em minúsculas, com sublinhado). */
export function codigoDaCategoria(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/** Nome do arquivo original para guardar (sem caminho nem caracteres de controle, até 120 caracteres). */
export function limparNomeArquivo(nome: string | null | undefined, padrao: string): string {
  let n = String(nome ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ');
  n = n.slice(n.lastIndexOf('/') + 1);
  n = n.slice(n.lastIndexOf('\\') + 1).replace(/\s+/g, ' ').trim();
  if (!n || /^\.+$/.test(n)) return padrao;
  if (n.length <= 120) return n;
  const ponto = n.lastIndexOf('.');
  const ext = ponto > 0 && n.length - ponto <= 10 ? n.slice(ponto) : '';
  return n.slice(0, 120 - ext.length).trimEnd() + ext;
}
