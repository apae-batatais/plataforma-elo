import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { lerTabelas } from '@/nucleo/armazenamento/tabela';
import { USUARIOS_FICTICIOS } from '@/nucleo/estrutura/dados-ficticios';
import { Areas, Atribuicoes, Perfis, Servicos, Usuarios } from '@/nucleo/estrutura/tabelas';
import { obterAplicacao } from '@/plataforma/aplicacao';
import { usuarioLogado } from '@/plataforma/sessao';
import { BotaoEnviar } from '@/ui/botao-enviar';
import { entrarNaDemonstracao } from '../acoes-sessao';
import { BotaoGoogle } from './botao-google';

export const metadata: Metadata = { title: 'Entrar' };

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[calc(100vh-2.5rem)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <section className="flex flex-col justify-between bg-lateral px-8 py-10 text-lateral-texto lg:px-12 lg:py-14">
        <div className="flex items-center gap-3 text-white">
          <span className="flex size-11 items-center justify-center rounded-xl bg-marca text-lg font-bold text-lateral" aria-hidden="true">
            A
          </span>
          <span className="leading-tight">
            <span className="block text-lg font-bold">APAE Batatais</span>
            <span className="block text-sm text-lateral-suave">Plataforma de gestão</span>
          </span>
        </div>
        <div className="mt-10 max-w-md lg:mt-0">
          <p className="text-[1.75rem] font-bold leading-tight text-white lg:text-[2.1rem]">
            As ferramentas de cada setor, num só lugar.
          </p>
          <p className="mt-3 text-lateral-suave">
            Orçamento, folha de pagamento, cadastro de pessoas e, em breve, a avaliação diagnóstica. Cada pessoa vê só o que o seu perfil permite.
          </p>
        </div>
        <p className="mt-10 hidden text-sm text-lateral-suave lg:block">Associação de Pais e Amigos dos Excepcionais de Batatais</p>
      </section>
      <section className="flex items-start justify-center px-5 py-10 lg:items-center lg:px-12">{children}</section>
    </div>
  );
}

const O_QUE_VE: Record<string, string> = {
  diretoria: 'Vê pessoas, auditoria e a folha completa.',
  administrador_plataforma: 'Configura acessos, serviços e planilhas.',
  financeiro: 'Opera a folha, o rateio e os parâmetros.',
  departamento_pessoal: 'Cadastra postos, salários e rateios.',
  coordenacao_servico: 'Vê atendidos e totais do seu escopo.',
  tecnico_avaliador: 'Vê atendidos do seu serviço.',
  leitura: 'Vê só totais e painéis.',
};

export default async function Entrar() {
  if (await usuarioLogado()) redirect('/');
  const app = await obterAplicacao();

  if (app.config.modo === 'producao') {
    return (
      <Moldura>
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Entrar</h1>
            <p className="mt-1.5 text-texto-suave">Use a sua conta institucional do Google, terminada em @{app.config.dominio}.</p>
          </div>
          <BotaoGoogle clientId={app.config.googleClientId} dominio={app.config.dominio} />
          <p className="text-sm text-texto-suave">
            Sem acesso? Peça à administração da plataforma para cadastrar o seu e-mail e o seu perfil.
          </p>
        </div>
      </Moldura>
    );
  }

  const [usuarios, atribuicoes, perfis, servicos, areas] = await lerTabelas(app.planilhas, [Usuarios, Atribuicoes, Perfis, Servicos, Areas] as const);
  const nomePerfil = new Map(perfis.todos().map((p) => [p.codigo, p.nome]));
  const nomeEscopo = new Map([...servicos.todos(), ...areas.todos()].map((s) => [s.codigo, s.nome]));
  const nomeUsuario = new Map<string, string>(USUARIOS_FICTICIOS.map((u) => [u.email, u.nome]));

  return (
    <Moldura>
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-bold">Entrar na demonstração</h1>
        <p className="mt-1.5 text-texto-suave">Escolha uma pessoa fictícia para ver a plataforma do jeito que ela vê.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {usuarios.ativos().map((u) => {
            const deles = atribuicoes.ativos().filter((a) => a.usuario_email === u.email);
            const nome = (nomeUsuario.get(u.email) ?? u.email).replace(/\s*\(fictíci[oa]\)/, '');
            return (
              <li key={u.id}>
                <form action={entrarNaDemonstracao} className="h-full">
                  <input type="hidden" name="email" value={u.email} />
                  <input type="hidden" name="nome" value={nomeUsuario.get(u.email) ?? u.email} />
                  <BotaoEnviar
                    variante="secundario"
                    enviando="Entrando…"
                    className="!h-full !w-full !flex-col !items-start !justify-start !gap-0.5 !rounded-lg !px-4 !py-3 text-left !font-normal"
                  >
                    <span className="font-semibold text-texto">{nome}</span>
                    <span className="text-sm text-destaque">
                      {deles.map((a) => `${nomePerfil.get(a.perfil) ?? a.perfil}${a.escopo ? ` · ${nomeEscopo.get(a.escopo) ?? a.escopo}` : ''}`).join(', ') || 'Sem perfil'}
                    </span>
                    <span className="text-sm text-texto-suave">{deles.map((a) => O_QUE_VE[a.perfil]).filter(Boolean)[0] ?? ''}</span>
                  </BotaoEnviar>
                </form>
              </li>
            );
          })}
        </ul>
      </div>
    </Moldura>
  );
}
