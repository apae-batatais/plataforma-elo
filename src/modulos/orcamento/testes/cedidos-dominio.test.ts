import { describe, expect, it } from 'vitest';
import { ativoNoMes, avisoDeFim, chaveDeNome, diasEntre, pendencias, situacaoDaCessao, validarCedente, validarCedido, validarLotacao, validarValor } from '../dominio/cedidos';
import { parametrosCom, validarParametros } from '../dominio/folha';

const c = (inicio: string, fim_previsto: string | null = null, encerramento: string | null = null) => ({ inicio, fim_previsto, encerramento });

describe('cedidos: regras puras', () => {
  it('ativo no mês: mês cheio, termina no encerramento ou no fim previsto', () => {
    expect(ativoNoMes(c('2027-03-15'), 2027, 3)).toBe(true);
    expect(ativoNoMes(c('2027-03-15'), 2027, 2)).toBe(false);
    expect(ativoNoMes(c('2027-01-01', '2027-04-10'), 2027, 4)).toBe(true);
    expect(ativoNoMes(c('2027-01-01', '2027-04-10'), 2027, 5)).toBe(false);
    expect(ativoNoMes(c('2027-01-01', '2027-12-31', '2027-02-10'), 2027, 3)).toBe(false);
    expect(ativoNoMes(c('2027-01-01'), 2030, 1)).toBe(true);
  });

  it('aviso: dentro do prazo, vencida, fora do prazo, encerrada e sem data', () => {
    expect(avisoDeFim(c('2027-01-01', '2027-03-01'), '2027-01-15', 60)).toMatchObject({ dias: 45, vencida: false });
    expect(avisoDeFim(c('2027-01-01', '2027-03-01'), '2027-03-05', 60)).toMatchObject({ dias: -4, vencida: true });
    expect(avisoDeFim(c('2027-01-01', '2027-06-01'), '2027-01-15', 60)).toBeNull();
    expect(avisoDeFim(c('2027-01-01', '2027-03-01', '2027-02-01'), '2027-01-15', 60)).toBeNull();
    expect(avisoDeFim(c('2027-01-01'), '2027-01-15', 60)).toBeNull();
    expect(avisoDeFim(c('2027-01-01', '2027-03-01'), '2027-01-15', 30)).toBeNull();
    expect(diasEntre('2027-01-01', '2027-01-31')).toBe(30);
  });

  it('situação: vencida e não encerrada continua ativa', () => {
    expect(situacaoDaCessao(c('2027-01-01', '2027-02-01'), '2027-03-01')).toBe('ativa');
    expect(situacaoDaCessao(c('2027-01-01', '2027-02-01', '2027-02-01'), '2027-03-01')).toBe('encerrada');
    expect(situacaoDaCessao(c('2027-05-01'), '2027-03-01')).toBe('futura');
  });

  it('cedente: nome obrigatório, único sem diferença de maiúscula, acento e espaço; tipo obrigatório', () => {
    expect(validarCedente({ nome: '', tipo: 'outro' }, [])).not.toEqual([]);
    expect(validarCedente({ nome: '  Órgão  Municipal ', tipo: 'poder_publico' }, ['orgao municipal'])).toHaveLength(1);
    expect(validarCedente({ nome: 'Empresa', tipo: 'x' }, [])).toHaveLength(1);
    expect(validarCedente({ nome: 'Empresa', tipo: 'empresa_pcd' }, [])).toEqual([]);
    expect(chaveDeNome(' Ação  Já ')).toBe('acao ja');
  });

  it('cedido: função, cedente e início; fim não antes do início; carga maior que zero', () => {
    const ok = { funcao: 'Auxiliar', cedenteId: 'x', inicio: '2027-02-01', fimPrevisto: null, cargaHoraria: null };
    expect(validarCedido(ok)).toEqual([]);
    expect(validarCedido({ ...ok, fimPrevisto: '2027-01-01' })).toHaveLength(1);
    expect(validarCedido({ ...ok, cargaHoraria: 0 })).toHaveLength(1);
    expect(validarCedido({ ...ok, funcao: '', cedenteId: '' })).toHaveLength(2);
  });

  it('valor e lotação', () => {
    expect(validarValor(0, 'informado', '2027-01-01')).toHaveLength(1);
    expect(validarValor(1000, 'calculado', '2027-01-01')).toHaveLength(1);
    expect(validarValor(1000.5, 'equivalente', '2027-01-01')).toEqual([]);
    expect(validarLotacao([{ centro: 'a', percentual: 90 }]).join(' ')).toContain('A lotação soma 90%');
    expect(validarLotacao([{ centro: 'a', percentual: 40 }, { centro: 'b', percentual: 60 }])).toEqual([]);
  });

  it('sem valor ou sem lotação a pessoa fica fora dos totais', () => {
    expect(pendencias(false, undefined)).toEqual(['valor', 'lotacao']);
    expect(pendencias(true, [{ centro: 'a', percentual: 100 }])).toEqual([]);
    expect(pendencias(true, [{ centro: 'a', percentual: 90 }])).toEqual(['lotacao']);
  });

  it('parâmetro do aviso: padrão 60, de 1 a 365', () => {
    const p = parametrosCom({});
    expect(p.cessao_aviso_dias).toBe(60);
    expect(validarParametros(p)).toEqual([]);
    expect(validarParametros({ ...p, cessao_aviso_dias: 0 })).toHaveLength(1);
    expect(validarParametros({ ...p, cessao_aviso_dias: 400 })).toHaveLength(1);
    expect(validarParametros({ ...p, cessao_aviso_dias: 30.5 })).toHaveLength(1);
  });
});
