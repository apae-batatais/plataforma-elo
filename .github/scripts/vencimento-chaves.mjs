// Aviso de vencimento das chaves (Secrets) do repositório.
//
// Os vencimentos ficam em .github/chaves.json (informados pela Diretoria; só nomes e datas,
// nunca valores). Uma vez por semana, o workflow Vencimentos abre uma issue "pendência da
// Diretoria" para cada chave que vence nos próximos 30 dias ou já venceu, sem repetir aviso
// que ainda está aberto.
//
// As funções de cima são puras e têm teste (tests/fluxo/vencimento-chaves.test.ts).

export const ETIQUETA = 'pendência da Diretoria';
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const DIA = 24 * 60 * 60 * 1000;

/** Confere o formato de .github/chaves.json; erro com o nome da chave errada. */
export function validarChaves(chaves) {
  if (!Array.isArray(chaves)) throw new Error('chaves.json precisa ser uma lista');
  for (const c of chaves) {
    if (!c || typeof c.nome !== 'string' || !c.nome) throw new Error('chave sem nome em chaves.json');
    if (c.vence !== null && !(typeof c.vence === 'string' && DATA.test(c.vence)))
      throw new Error(`${c.nome}: "vence" precisa ser AAAA-MM-DD ou null`);
    if (typeof c.renovar !== 'string' || !c.renovar) throw new Error(`${c.nome}: falta "renovar"`);
  }
  return chaves;
}

function dias(de, ate) {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / DIA);
}

/** Chaves que vencem em até `antecedencia` dias (ou já venceram), com os dias que faltam. */
export function avisosDevidos(chaves, hoje, antecedencia = 30) {
  return chaves
    .filter((c) => c.vence)
    .map((c) => ({ ...c, dias: dias(hoje, c.vence) }))
    .filter((c) => c.dias <= antecedencia);
}

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** Título da issue de aviso; inclui a data, para avisar de novo depois de cada renovação. */
export function tituloDoAviso(chave) {
  return `Renovar a chave ${chave.nome} (vence em ${dataBR(chave.vence)})`;
}

function corpoDoAviso(c) {
  const prazo = c.dias < 0 ? `venceu há ${-c.dias} dias` : c.dias === 0 ? 'vence hoje' : `vence em ${c.dias} dias`;
  return [
    `A chave \`${c.nome}\` ${prazo} (${dataBR(c.vence)}). Vencida, ela faz as automações que dependem dela falharem.`,
    '',
    '### Como renovar',
    c.renovar,
    '',
    '### Depois de renovar',
    `Peça ao DevOps para atualizar a data em \`.github/chaves.json\` e feche esta issue.`,
    '',
    '_Aviso automático do workflow Vencimentos._',
  ].join('\n');
}

/** Abre as pendências que faltam. */
export async function executar({ github, context, core, chaves, hoje, antecedencia = 30 }) {
  const devidos = avisosDevidos(validarChaves(chaves), hoje, antecedencia);
  if (devidos.length === 0) {
    core.info('Nenhuma chave vence nos próximos dias.');
    return;
  }
  const { owner, repo } = context.repo;
  const abertas = await github.paginate(github.rest.issues.listForRepo, {
    owner, repo, state: 'open', labels: ETIQUETA, per_page: 100,
  });
  const titulos = new Set(abertas.map((i) => i.title));
  for (const c of devidos) {
    const title = tituloDoAviso(c);
    if (titulos.has(title)) {
      core.info(`Aviso já aberto: ${title}`);
      continue;
    }
    const { data } = await github.rest.issues.create({ owner, repo, title, body: corpoDoAviso(c), labels: [ETIQUETA] });
    core.info(`Aviso aberto: #${data.number} ${title}`);
  }
}
