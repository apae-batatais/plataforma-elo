import { describe, expect, it, vi } from 'vitest';
import { avisosDevidos, executar, tituloDoAviso, validarChaves } from '../../.github/scripts/vencimento-chaves.mjs';
import chavesDoRepositorio from '../../.github/chaves.json';

const chaves = [
  { nome: 'QUADRO_TOKEN', vence: '2027-02-06', renovar: 'github.com/settings/personal-access-tokens' },
  { nome: 'CLAUDE_CODE_OAUTH_TOKEN', vence: '2027-11-08', renovar: 'claude setup-token' },
  { nome: 'NETLIFY_AUTH_TOKEN', vence: null, renovar: 'app.netlify.com' },
];

describe('avisosDevidos', () => {
  it('não avisa antes dos 30 dias', () => {
    expect(avisosDevidos(chaves, '2027-01-06')).toEqual([]);
  });

  it('avisa a partir de 30 dias antes, com os dias que faltam', () => {
    expect(avisosDevidos(chaves, '2027-01-07')).toEqual([{ ...chaves[0], dias: 30 }]);
    expect(avisosDevidos(chaves, '2027-02-06')).toEqual([{ ...chaves[0], dias: 0 }]);
  });

  it('continua avisando depois de vencida', () => {
    expect(avisosDevidos(chaves, '2027-02-10')).toEqual([{ ...chaves[0], dias: -4 }]);
  });

  it('nunca avisa chave sem vencimento', () => {
    expect(avisosDevidos(chaves, '2099-01-01').map((c: { nome: string }) => c.nome)).not.toContain('NETLIFY_AUTH_TOKEN');
  });

  it('aceita outra antecedência', () => {
    expect(avisosDevidos(chaves, '2027-01-20', 15)).toEqual([]);
    expect(avisosDevidos(chaves, '2027-01-22', 15)).toEqual([{ ...chaves[0], dias: 15 }]);
  });
});

describe('tituloDoAviso', () => {
  it('traz o nome e a data no formato brasileiro', () => {
    expect(tituloDoAviso(chaves[0])).toBe('Renovar a chave QUADRO_TOKEN (vence em 06/02/2027)');
  });
});

describe('validarChaves', () => {
  it('aceita o arquivo do repositório', () => {
    expect(() => validarChaves(chavesDoRepositorio)).not.toThrow();
  });

  it('recusa data em formato errado', () => {
    expect(() => validarChaves([{ nome: 'X', vence: '06/02/2027', renovar: 'a' }])).toThrow(/X/);
  });

  it('recusa chave sem nome ou sem onde renovar', () => {
    expect(() => validarChaves([{ nome: '', vence: null, renovar: 'a' }])).toThrow();
    expect(() => validarChaves([{ nome: 'X', vence: null }])).toThrow(/X/);
  });
});

describe('executar', () => {
  function githubFalso(abertas: { title: string }[]) {
    return {
      rest: { issues: { listForRepo: vi.fn(), create: vi.fn<(pedido: { title: string; body: string; labels: string[] }) => Promise<{ data: { number: number } }>>(async () => ({ data: { number: 99 } })) } },
      paginate: vi.fn(async () => abertas),
    };
  }
  const context = { repo: { owner: 'apae-batatais', repo: 'plataforma-elo' } };
  const core = { info: vi.fn() };

  it('abre uma pendência da Diretoria para cada chave perto de vencer', async () => {
    const github = githubFalso([]);
    await executar({ github, context, core, chaves, hoje: '2027-01-10' });
    expect(github.rest.issues.create).toHaveBeenCalledTimes(1);
    const pedido = github.rest.issues.create.mock.calls[0]![0];
    expect(pedido.title).toBe('Renovar a chave QUADRO_TOKEN (vence em 06/02/2027)');
    expect(pedido.labels).toEqual(['pendência da Diretoria']);
    expect(pedido.body).toContain('27 dias');
    expect(pedido.body).toContain('github.com/settings/personal-access-tokens');
  });

  it('não repete o aviso se a pendência já está aberta', async () => {
    const github = githubFalso([{ title: 'Renovar a chave QUADRO_TOKEN (vence em 06/02/2027)' }]);
    await executar({ github, context, core, chaves, hoje: '2027-01-17' });
    expect(github.rest.issues.create).not.toHaveBeenCalled();
  });

  it('avisa de novo quando a chave renovada chega perto do novo vencimento', async () => {
    const github = githubFalso([{ title: 'Renovar a chave QUADRO_TOKEN (vence em 06/02/2027)' }]);
    const renovada = [{ ...chaves[0], vence: '2028-02-06' }];
    await executar({ github, context, core, chaves: renovada, hoje: '2028-01-10' });
    expect(github.rest.issues.create).toHaveBeenCalledTimes(1);
  });

  it('não abre nada quando nenhuma chave está perto de vencer', async () => {
    const github = githubFalso([]);
    await executar({ github, context, core, chaves, hoje: '2026-11-09' });
    expect(github.rest.issues.create).not.toHaveBeenCalled();
    expect(github.paginate).not.toHaveBeenCalled();
  });
});
