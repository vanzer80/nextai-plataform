import React from 'react';
import { NextAILogo } from '@/src/components/brand/NextAILogo';

const LAST_UPDATED = '24 de maio de 2026';
const VERSION = '1.0';

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-xl font-bold text-foreground mt-10 mb-4 pb-2 border-b border-border">{title}</h2>
      <div className="space-y-4 text-sm text-foreground/80 leading-relaxed">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60">
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-2.5 font-semibold text-foreground text-xs uppercase tracking-wide border-b border-border">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top border-b border-border/50 last:border-0">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
      {children}
    </div>
  );
}

const TOC = [
  { id: 's1',  label: '1. Quem somos' },
  { id: 's2',  label: '2. A quem esta Política se aplica' },
  { id: 's3',  label: '3. Dados que coletamos' },
  { id: 's4',  label: '4. Como e por que usamos seus dados' },
  { id: 's5',  label: '5. Banco de Inteligência NextAI' },
  { id: 's6',  label: '6. Compartilhamento e subprocessadores' },
  { id: 's7',  label: '7. Transferência internacional' },
  { id: 's8',  label: '8. Retenção de dados' },
  { id: 's9',  label: '9. Segurança da informação' },
  { id: 's10', label: '10. Seus direitos (LGPD)' },
  { id: 's11', label: '11. Cookies' },
  { id: 's12', label: '12. Menores de idade' },
  { id: 's13', label: '13. Alterações nesta Política' },
  { id: 's14', label: '14. Contato / DPO' },
  { id: 's15', label: '15. Histórico de versões' },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <a href="/login" className="flex items-center gap-2 text-foreground hover:opacity-80 transition-opacity">
            <NextAILogo height={28} />
          </a>
          <div className="text-xs text-muted-foreground">
            Versão {VERSION} · Vigência: {LAST_UPDATED}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 lg:py-14">
        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">

          {/* Sidebar / TOC (desktop) */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Sumário</p>
              {TOC.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="block text-xs text-muted-foreground hover:text-primary hover:underline py-0.5 transition-colors"
                >
                  {label}
                </a>
              ))}
            </div>
          </aside>

          {/* Main content */}
          <main className="min-w-0">

            {/* Hero */}
            <div className="mb-10">
              <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
              <p className="text-sm text-muted-foreground">
                NextAI Tecnologia LTDA · CNPJ 37.771.984/0001-14 · Versão {VERSION} · Vigente desde {LAST_UPDATED}
              </p>
            </div>

            {/* Section 1 */}
            <Section id="s1" title="1. Quem somos">
              <p>
                A <strong>NextAI Tecnologia LTDA</strong>, inscrita no CNPJ sob o nº <strong>37.771.984/0001-14</strong>,
                é uma empresa brasileira de tecnologia que desenvolve e opera a plataforma <strong>NextAI</strong> —
                um sistema SaaS de gestão de ordens de serviço, reembolsos, orçamentos e base de conhecimento técnico,
                com recursos de inteligência artificial integrados.
              </p>
              <p>
                A NextAI atua como <strong>operadora</strong> dos dados de colaboradores e clientes das empresas que
                contratam a plataforma (tenants) e como <strong>controladora</strong> dos dados que coleta diretamente
                para fins de operação, segurança e melhoria contínua do serviço.
              </p>
              <p>
                Esta Política está em conformidade com a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD)
                — Lei nº 13.709/2018</strong> e demais normas aplicáveis.
              </p>
            </Section>

            {/* Section 2 */}
            <Section id="s2" title="2. A quem esta Política se aplica">
              <Table
                headers={['Grupo', 'Quem são', 'Exemplos']}
                rows={[
                  ['Usuários da plataforma', 'Colaboradores das empresas clientes da NextAI que utilizam o sistema', 'Técnicos de campo, gestores, administradores'],
                  ['Clientes dos tenants', 'Pessoas físicas e jurídicas cujos dados aparecem nas OS e orçamentos', 'Empresas e responsáveis que contratam serviços de manutenção/engenharia'],
                  ['Representantes dos tenants', 'Administradores e responsáveis legais das empresas clientes da NextAI', 'Sócios, diretores, encarregados de TI'],
                ]}
              />
              <Highlight>
                <strong>Responsabilidade compartilhada:</strong> o tenant (empresa cliente) é o <strong>controlador</strong> dos
                dados de seus colaboradores e clientes finais. A NextAI processa esses dados sob instrução do tenant e em
                conformidade com esta Política e com o contrato de prestação de serviços vigente.
              </Highlight>
            </Section>

            {/* Section 3 */}
            <Section id="s3" title="3. Dados que coletamos">
              <p className="font-semibold text-foreground">3.1 Dados de identificação e acesso</p>
              <Table
                headers={['Dado', 'Finalidade', 'Base legal (LGPD)']}
                rows={[
                  ['Nome completo', 'Identificação no sistema', 'Art. 7º, V — execução de contrato'],
                  ['Endereço de e-mail', 'Login, notificações, comunicações', 'Art. 7º, V — execução de contrato'],
                  ['Senha (hash seguro)', 'Autenticação', 'Art. 7º, V — execução de contrato'],
                  ['Perfil de acesso (role)', 'Controle de permissões RBAC', 'Art. 7º, V — execução de contrato'],
                  ['Logs de acesso, IP, user-agent', 'Segurança, auditoria, prevenção de fraudes', 'Art. 7º, IX — legítimo interesse'],
                ]}
              />
              <p className="font-semibold text-foreground pt-2">3.2 Dados operacionais das Ordens de Serviço</p>
              <Table
                headers={['Dado', 'Finalidade', 'Base legal (LGPD)']}
                rows={[
                  ['Localização GPS (lat, lng, precisão)', 'Registro do local de execução do serviço', 'Art. 7º, V — execução de contrato; Art. 7º, I — consentimento in-app'],
                  ['Fotografias e anexos', 'Documentação técnica', 'Art. 7º, V — execução de contrato'],
                  ['Assinatura digital do cliente', 'Confirmação e aceite do serviço', 'Art. 7º, V — execução de contrato'],
                  ['Diagnóstico, recomendações técnicas', 'Registro técnico e insumo para IA', 'Art. 7º, V — execução de contrato; Art. 7º, IX — legítimo interesse'],
                  ['Dados de equipamentos', 'Gestão de ativos e histórico de manutenção', 'Art. 7º, V — execução de contrato'],
                  ['Dados de reembolsos (valor, CNPJ, PIX)', 'Gestão financeira interna do tenant', 'Art. 7º, V — execução de contrato'],
                ]}
              />
              <p className="font-semibold text-foreground pt-2">3.3 Dados dos clientes dos tenants</p>
              <Table
                headers={['Dado', 'Finalidade', 'Base legal (LGPD)']}
                rows={[
                  ['Nome / razão social', 'Vinculação da OS ao cliente', 'Art. 7º, V — execução de contrato com o tenant'],
                  ['Endereço e unidade', 'Localização do serviço', 'Art. 7º, V — execução de contrato com o tenant'],
                  ['Dados de contato', 'Comunicação sobre a OS', 'Art. 7º, V — execução de contrato com o tenant'],
                ]}
              />
            </Section>

            {/* Section 4 */}
            <Section id="s4" title="4. Como e por que usamos seus dados">
              <Table
                headers={['Finalidade', 'Descrição']}
                rows={[
                  ['Prestação do serviço', 'Operação de todos os módulos da plataforma: OS, reembolsos, orçamentos, base de conhecimento, gestão de equipamentos e usuários.'],
                  ['Autenticação e segurança', 'Verificação de identidade, controle de sessões, prevenção de acessos não autorizados e detecção de anomalias.'],
                  ['Notificações e alertas', 'Comunicação de eventos relevantes na plataforma (aprovação de OS, reembolsos, compras).'],
                  ['Geração de documentos', 'PDFs de OS, orçamentos e relatórios para entrega ao cliente final do tenant.'],
                  ['Suporte técnico', 'Análise de logs para diagnóstico e resolução de incidentes.'],
                  ['Melhoria da IA', 'Conforme descrito na Seção 5 desta Política.'],
                  ['Cumprimento legal', 'Resposta a requisições de autoridades e normas regulatórias.'],
                ]}
              />
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
                <p className="font-semibold text-foreground mb-1">O que não fazemos:</p>
                <ul className="list-disc ml-4 space-y-1 text-foreground/80">
                  <li>Não vendemos dados pessoais a terceiros.</li>
                  <li>Não utilizamos dados pessoais identificáveis para fins publicitários.</li>
                  <li>Não compartilhamos dados entre tenants — cada empresa tem ambiente isolado com acesso exclusivo aos próprios dados.</li>
                  <li>Não utilizamos dados para tomada de decisão automatizada com efeitos jurídicos sobre os titulares.</li>
                </ul>
              </div>
            </Section>

            {/* Section 5 */}
            <Section id="s5" title="5. Banco de Inteligência NextAI — Melhoria Contínua da IA">
              <p>
                A NextAI mantém um <strong>Banco de Inteligência</strong> com dados técnicos consolidados de todos os
                tenants da plataforma, utilizado exclusivamente para treinar, avaliar e aprimorar os modelos de
                inteligência artificial integrados ao sistema (diagnóstico assistido por IA, sugestões de
                recomendação técnica, base de conhecimento automatizada).
              </p>
              <p>O acesso a este banco é restrito ao time técnico da NextAI e não é acessível a nenhum tenant, colaborador ou terceiro.</p>
              <p className="font-semibold text-foreground">Quais dados são incluídos no corpus</p>
              <Table
                headers={['Incluído no corpus', 'Excluído do corpus']}
                rows={[
                  ['Tipo de serviço', 'Nome do técnico responsável'],
                  ['Problema relatado', 'Nome / razão social do cliente'],
                  ['Diagnóstico preliminar e final', 'Notas internas e comentários do revisor'],
                  ['Recomendação técnica', 'Localização GPS'],
                  ['Serviços executados e peças utilizadas', 'Assinatura digital'],
                  ['Artigos da base de conhecimento (título, conteúdo, tags)', 'Dados financeiros (valores, PIX, CNPJ)'],
                ]}
              />
              <p>
                Os dados são <strong>pseudonimizados</strong>: identificados apenas por códigos internos (UUIDs),
                sem qualquer referência a nomes, e-mails ou identificadores diretos.
              </p>
              <p className="font-semibold text-foreground">Base legal</p>
              <p>
                O tratamento é fundamentado no <strong>legítimo interesse da NextAI</strong> (Art. 7º, IX da LGPD),
                consistente com a finalidade de melhoria contínua do serviço contratado pelos tenants. O risco de
                reidentificação é mínimo dado o grau de anonimização aplicado, e a finalidade beneficia diretamente
                os próprios usuários da plataforma.
              </p>
              <p className="font-semibold text-foreground">Auditoria e opt-out</p>
              <p>
                Todo acesso ao Banco de Inteligência é registrado automaticamente com data, hora e ação realizada.
                Tenants que desejarem excluir seus dados do corpus podem solicitar isso pelo canal indicado na Seção 14.
                A exclusão não afeta os dados operacionais do tenant na plataforma.
              </p>
            </Section>

            {/* Section 6 */}
            <Section id="s6" title="6. Compartilhamento com terceiros e subprocessadores">
              <Table
                headers={['Subprocessador', 'Papel', 'Dados acessados', 'País']}
                rows={[
                  ['Supabase Inc.', 'Banco de dados, autenticação, storage, funções serverless', 'Todos os dados da plataforma', 'EUA (servidores em São Paulo — sa-east-1)'],
                  ['Vercel Inc.', 'Hospedagem do frontend e CDN', 'Logs de acesso, IPs, user-agents', 'EUA (CDN global)'],
                  ['Google LLC (Gemini AI)', 'Processamento de IA para diagnóstico assistido', 'Texto de diagnóstico — sem identificadores pessoais', 'EUA'],
                  ['OpenAI LLC', 'Processamento de IA alternativo (OCR e diagnóstico)', 'Imagens e texto — sem identificadores pessoais', 'EUA'],
                ]}
              />
              <p>
                A NextAI exige de todos os subprocessadores acordos de processamento de dados (DPA) e manutenção de
                padrões equivalentes de proteção. Compartilhamos dados com terceiros também nas seguintes situações:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Autoridades públicas:</strong> quando exigido por lei, ordem judicial ou investigação legítima.</li>
                <li><strong>Auditores e assessores jurídicos:</strong> sob obrigação de confidencialidade.</li>
                <li><strong>Sucessores corporativos:</strong> em caso de fusão ou aquisição, com notificação prévia.</li>
              </ul>
            </Section>

            {/* Section 7 */}
            <Section id="s7" title="7. Transferência internacional de dados">
              <p>
                Os subprocessadores Supabase, Vercel, Google e OpenAI estão sediados nos Estados Unidos da América.
                A NextAI adota as seguintes salvaguardas:
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Contratos com cláusulas contratuais padrão de proteção de dados;</li>
                <li>Preferência por servidores na América do Sul (Supabase region <code>sa-east-1</code> — São Paulo/BR);</li>
                <li>Avaliação periódica de adequação dos subprocessadores.</li>
              </ul>
            </Section>

            {/* Section 8 */}
            <Section id="s8" title="8. Retenção de dados">
              <Table
                headers={['Categoria', 'Período de retenção', 'Critério']}
                rows={[
                  ['Dados de conta (nome, e-mail, role)', 'Vínculo ativo + 5 anos após encerramento', 'Prescrição legal e audit trail'],
                  ['Ordens de serviço e anexos', 'Contrato ativo + 5 anos', 'Obrigação legal (Código Civil, Art. 205)'],
                  ['Dados financeiros e de reembolsos', '5 anos após fechamento do exercício fiscal', 'Obrigação legal (Código Tributário)'],
                  ['Logs de acesso e auditoria', '2 anos', 'Segurança e detecção de fraudes'],
                  ['Corpus de IA (anonimizados)', 'Indefinido, enquanto relevantes para treino', 'Melhoria contínua do serviço'],
                  ['Dados de CSAT', '3 anos', 'Melhoria do serviço'],
                  ['Backups', '30 dias corridos', 'Recuperação de desastres'],
                ]}
              />
              <p>Após os períodos indicados, os dados são eliminados de forma segura ou anonimizados de maneira irreversível.</p>
            </Section>

            {/* Section 9 */}
            <Section id="s9" title="9. Segurança da informação">
              <p className="font-semibold text-foreground">Medidas técnicas</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Isolamento multi-tenant por Row Level Security (RLS) — cada empresa acessa exclusivamente seus dados</li>
                <li>Criptografia em trânsito (TLS 1.2+) e em repouso (AES-256)</li>
                <li>Senhas com hash seguro; proteção contra senhas comprometidas (HaveIBeenPwned)</li>
                <li>Controle de acesso baseado em papéis (RBAC) com 8 perfis distintos</li>
                <li>Auditoria de acessos privilegiados</li>
              </ul>
              <p className="font-semibold text-foreground pt-2">Medidas organizacionais</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Política de acesso mínimo ao ambiente de produção</li>
                <li>Avaliação periódica de vulnerabilidades e auditorias de segurança</li>
                <li>Procedimento de resposta a incidentes de segurança</li>
              </ul>
              <Highlight>
                Em caso de incidente de segurança, a NextAI notificará a ANPD e os tenants afetados em até{' '}
                <strong>72 horas</strong> após a confirmação, conforme exigido pela LGPD.
              </Highlight>
            </Section>

            {/* Section 10 */}
            <Section id="s10" title="10. Seus direitos como titular">
              <Table
                headers={['Direito', 'Descrição', 'Como exercer']}
                rows={[
                  ['Confirmação e acesso', 'Saber se tratamos seus dados e obter cópia deles', 'Solicitação por e-mail ao DPO'],
                  ['Correção', 'Corrigir dados incompletos, inexatos ou desatualizados', 'Direto na plataforma ou via DPO'],
                  ['Anonimização / bloqueio / eliminação', 'Para dados desnecessários ou em desconformidade', 'Solicitação por e-mail ao DPO'],
                  ['Portabilidade', 'Receber seus dados em formato estruturado e interoperável', 'Solicitação por e-mail ao DPO'],
                  ['Revogação do consentimento', 'Retirar consentimento dado anteriormente', 'Solicitação por e-mail ao DPO'],
                  ['Informação sobre compartilhamento', 'Saber com quais terceiros compartilhamos seus dados', 'Esta Política — Seção 6'],
                  ['Petição à ANPD', 'Reclamação à Autoridade Nacional de Proteção de Dados', 'gov.br/anpd'],
                ]}
              />
              <p>
                <strong>Prazo de resposta:</strong> até <strong>15 dias corridos</strong> após o recebimento da
                solicitação, prorrogáveis por igual período mediante justificativa.
              </p>
            </Section>

            {/* Section 11 */}
            <Section id="s11" title="11. Cookies e tecnologias de rastreamento">
              <Table
                headers={['Tipo', 'Finalidade', 'Persistência']}
                rows={[
                  ['Cookies de sessão (auth)', 'Manter o usuário autenticado entre páginas', 'Até logout ou 7 dias'],
                  ['LocalStorage / IndexedDB', 'Cache de rascunhos de OS e configurações da aplicação', 'Até limpeza manual ou desinstalação do PWA'],
                  ['Service Worker Cache', 'Disponibilidade offline (PWA)', 'Até atualização de versão'],
                ]}
              />
              <p>A NextAI <strong>não</strong> utiliza cookies de rastreamento de terceiros, cookies publicitários ou ferramentas de analytics comportamental.</p>
            </Section>

            {/* Section 12 */}
            <Section id="s12" title="12. Dados de menores de idade">
              <p>
                A plataforma NextAI é um sistema <strong>B2B</strong> destinado exclusivamente a uso profissional
                corporativo. Não coletamos intencionalmente dados de pessoas menores de 18 anos. Se identificarmos
                que dados de um menor foram inadvertidamente inseridos, procederemos à exclusão imediata mediante
                solicitação.
              </p>
            </Section>

            {/* Section 13 */}
            <Section id="s13" title="13. Alterações nesta Política">
              <p>
                Esta Política pode ser atualizada periodicamente para refletir mudanças nos nossos serviços,
                requisitos legais ou práticas de privacidade. A versão vigente sempre estará disponível nesta
                página (<code>/privacy</code>).
              </p>
              <ul className="list-disc ml-5 space-y-1">
                <li><strong>Alterações materiais</strong> (que impactem direitos dos titulares): notificação por e-mail com 30 dias de antecedência.</li>
                <li><strong>Alterações não materiais</strong>: publicação da nova versão com destaque de mudanças no Histórico de Versões.</li>
              </ul>
            </Section>

            {/* Section 14 */}
            <Section id="s14" title="14. Contato e canal de atendimento ao titular">
              <div className="rounded-xl border border-border bg-muted/30 p-6 space-y-2">
                <p className="font-semibold text-foreground text-base">Encarregado pelo Tratamento de Dados (DPO)</p>
                <p><strong>NextAI Tecnologia LTDA</strong></p>
                <p>CNPJ: 37.771.984/0001-14</p>
                <p>E-mail: <a href="mailto:nextai@nextai.com" className="text-primary underline">nextai@nextai.com</a></p>
                <p className="text-muted-foreground text-xs pt-2">Prazo de resposta: até 15 dias corridos após o recebimento da solicitação.</p>
              </div>
              <p>
                Você também pode registrar reclamações diretamente na{' '}
                <strong>Autoridade Nacional de Proteção de Dados (ANPD)</strong>:{' '}
                <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  www.gov.br/anpd
                </a>
              </p>
            </Section>

            {/* Section 15 */}
            <Section id="s15" title="15. Histórico de versões">
              <Table
                headers={['Versão', 'Data', 'Principais mudanças']}
                rows={[
                  ['1.0', '24/05/2026', 'Versão inicial. Cobertura completa da plataforma NextAI: módulos de OS, reembolsos, orçamentos, KB, IA e Banco de Inteligência. Conformidade LGPD.'],
                ]}
              />
            </Section>

            {/* Footer */}
            <div className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground space-y-2">
              <p>
                Esta Política é regida pelas leis da República Federativa do Brasil. Fica eleito o foro da
                Comarca de domicílio da NextAI Tecnologia LTDA para dirimir quaisquer controvérsias dela
                decorrentes, com renúncia expressa a qualquer outro, por mais privilegiado que seja.
              </p>
              <p>© 2026 NextAI Tecnologia LTDA. Todos os direitos reservados.</p>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}
