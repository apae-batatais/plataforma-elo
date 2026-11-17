import { describe, expect, it } from 'vitest';
import { conferirLoginGoogle } from '@/nucleo/sessao/google';
import { assinarSessao, lerSessao } from '@/nucleo/sessao/token';

const segredo = 'um-segredo-de-teste-com-mais-de-32-caracteres';

describe('sessão', () => {
  it('assina e lê; segredo errado ou token adulterado não valem', async () => {
    const t = await assinarSessao(segredo, 'ana@inst-a-exemplo.org.br', 'Ana');
    expect(await lerSessao(segredo, t)).toEqual({ email: 'ana@inst-a-exemplo.org.br', nome: 'Ana' });
    expect(await lerSessao('outro-segredo-qualquer-com-32-caracteres!!', t)).toBeNull();
    expect(await lerSessao(segredo, `${t}x`)).toBeNull();
    expect(await lerSessao(segredo, undefined)).toBeNull();
  });
});

describe('login Google', () => {
  const cliente = (payload: Record<string, unknown> | Error) => ({
    verifyIdToken: async () => {
      if (payload instanceof Error) throw payload;
      return { getPayload: () => payload } as never;
    },
  });

  it('aceita conta institucional verificada', async () => {
    const id = await conferirLoginGoogle('tok', 'cid', 'inst-a-exemplo.org.br', cliente({ email: 'Ana@inst-a-exemplo.org.br', email_verified: true, hd: 'inst-a-exemplo.org.br', name: 'Ana' }));
    expect(id).toEqual({ email: 'ana@inst-a-exemplo.org.br', nome: 'Ana' });
  });

  it('recusa conta de outro domínio, e-mail não verificado e token inválido', async () => {
    await expect(conferirLoginGoogle('tok', 'cid', 'inst-a-exemplo.org.br', cliente({ email: 'x@gmail.com', email_verified: true }))).rejects.toThrow(/institucional/);
    await expect(conferirLoginGoogle('tok', 'cid', 'inst-a-exemplo.org.br', cliente({ email: 'x@inst-a-exemplo.org.br', email_verified: false, hd: 'inst-a-exemplo.org.br' }))).rejects.toThrow(/não verificado/);
    await expect(conferirLoginGoogle('tok', 'cid', 'inst-a-exemplo.org.br', cliente(new Error('assinatura')))).rejects.toThrow(/confirmar o login/);
  });
});
