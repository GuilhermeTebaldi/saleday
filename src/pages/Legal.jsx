// diretrizes
import { useContext, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import api from '../api/api.js';
import { AuthContext } from '../context/AuthContext.jsx';
import CloseBackButton from '../components/CloseBackButton.jsx';

function Section({ id, title, children }) {
  return (
    <section id={id} className="legal-section">
      <h2>{title}</h2>
      <div className="legal-content">{children}</div>
    </section>
  );
}

const LEGAL_VERSION_LABEL = '27 de outubro de 2025';

export default function Legal() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isReconsent = params.get('reconsent') === '1';
  const redirectTarget = params.get('redirect') || '/';
  const loginRedirect = `/login?next=${encodeURIComponent(
    `/politica-de-privacidade${location.search || ''}`
  )}`;

  const handleAccept = async () => {
    if (!user) {
      toast.error('Faça login para concluir o aceite.');
      navigate(loginRedirect);
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/accept-legal', {
        acceptLegal: true,
        source: 'legal-page'
      });
      toast.success('Aceite registrado. Obrigado!');
      setTimeout(() => {
        window.location.assign(redirectTarget || '/');
      }, 600);
    } catch (err) {
      const message =
        err?.response?.data?.message || 'Não foi possível registrar seu aceite. Tente novamente.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="legal-page">
      <CloseBackButton />
      <header>
        <p className="legal-eyebrow">Vigência imediata • Abrangência: Brasil e Estados Unidos</p>
        <h1>Política de Privacidade – TempleSale</h1>
        <p className="legal-meta">Última atualização: {LEGAL_VERSION_LABEL}</p>
      </header>

      {isReconsent && (
        <div className="legal-reconsent" role="alert">
          <div>
            <strong>Você precisa aceitar nossa Política, Termos e Diretrizes para continuar usando o TempleSale.</strong>
            <p className="legal-reconsent__hint">
              Versão vigente: {LEGAL_VERSION_LABEL}. O TempleSale não responde por golpes entre terceiros — você é
              responsável por avaliar cada negociação.
            </p>
          </div>
          <div className="legal-reconsent__actions">
            {user ? (
              <button
                type="button"
                className="btn-primary"
                onClick={handleAccept}
                disabled={submitting}
              >
                {submitting ? 'Registrando...' : 'Concordar e continuar'}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => navigate(loginRedirect)}>
                Fazer login para aceitar
              </button>
            )}
          </div>
        </div>
      )}

      <Section id="quem-somos" title="1. Quem somos">
        <ul>
          <li>Controlador: TempleSale (“TempleSale”, “nós”).</li>
          <li>Contato do DPO/Encarregado: templesale.world@gmail.com</li>
        </ul>
      </Section>

      <Section id="o-que-fazemos" title="2. O que o TempleSale faz">
        <p>
          Somos uma plataforma de classificados online com chat entre usuários. Não processamos pagamentos, não
          custodimos valores, não garantimos entrega, não avaliamos qualidade dos produtos e não participamos da
          negociação. Fornecemos ferramentas de anúncio, busca e conversa.
        </p>
      </Section>

      <Section id="dados" title="3. Dados que coletamos">
        <h3>3.1 Dados fornecidos por você</h3>
        <ul>
          <li>Conta: nome de usuário, e-mail, senha.</li>
          <li>Perfil e contato: telefone, país, estado, cidade, bairro, rua, CEP.</li>
          <li>Conteúdo: fotos, título, descrição, preço, categoria, localização.</li>
          <li>Mensagens: conteúdo das conversas no chat interno.</li>
          <li>Suporte: informações enviadas ao atendimento e denúncias.</li>
        </ul>
        <h3>3.2 Dados coletados automaticamente</h3>
        <ul>
          <li>Identificadores: IP, User-Agent, IDs de sessão.</li>
          <li>Geolocalização aproximada (quando você permite o GPS no navegador).</li>
          <li>Cookies/armazenamento local: token de sessão, preferências, favoritos.</li>
          <li>Registros de uso: páginas acessadas, datas/horas, recursos utilizados, erros.</li>
        </ul>
        <h3>3.3 Dados de terceiros</h3>
        <ul>
          <li>Geocodificação e mapas para converter coordenadas em endereço e vice-versa.</li>
          <li>Hospedagem, infraestrutura, monitoramento e segurança.</li>
          <li>Fornecedores antifraude, quando necessário.</li>
        </ul>
      </Section>

      <Section id="finalidades" title="4. Finalidades, bases legais e direitos">
        <h3>4.1 Finalidades</h3>
        <ul>
          <li>Criar e manter contas.</li>
          <li>Exibir anúncios e permitir buscas por região.</li>
          <li>Operar o chat entre compradores e vendedores.</li>
          <li>Moderação, segurança e prevenção a fraudes ou spam.</li>
          <li>Comunicar sobre a conta e o serviço.</li>
          <li>Realizar melhorias, métricas e estatísticas agregadas.</li>
        </ul>
        <h3>4.2 Bases legais (LGPD – Brasil)</h3>
        <ul>
          <li>Execução de contrato.</li>
          <li>Cumprimento de obrigação legal/regulatória.</li>
          <li>Legítimo interesse (segurança, prevenção a abuso, melhorias).</li>
          <li>Consentimento quando exigido (por exemplo, uso de GPS).</li>
        </ul>
        <h3>4.3 Direitos dos titulares (LGPD)</h3>
        <p>
          Confirmação de tratamento e acesso, correção, anonimização/bloqueio/eliminação, portabilidade, informação
          sobre compartilhamento, revogação do consentimento e revisão de decisões automatizadas. Solicite por
          templesale.world@gmail.com (prazo: até 15 dias).
        </p>
        <h3>4.4 Direitos de residentes na Califórnia (CCPA/CPRA)</h3>
        <p>
          Saber, acessar, corrigir e deletar dados; opt-out de venda/compartilhamento (não vendemos dados pessoais);
          não discriminação por exercício de direitos. Solicite por templesale.world@gmail.com (prazo: até 45 dias).
        </p>
      </Section>

      <Section id="cookies" title="5. Cookies e tecnologias similares">
        <p>
          Utilizamos cookies de sessão (autenticação JWT), preferências (idioma e favoritos) e segurança (detecção de
          abuso). Você pode gerenciar cookies no navegador, mas restrições podem limitar funcionalidades.
        </p>
      </Section>

      <Section id="compartilhamento" title="6. Compartilhamento de dados">
        <p>
          Compartilhamos somente o necessário com provedores de geocodificação e mapas, hospedagem, banco de dados,
          monitoramento, segurança e autoridades públicas mediante obrigação legal. Não vendemos dados pessoais.
        </p>
      </Section>

      <Section id="transferencias" title="7. Transferências internacionais">
        <p>
          O tratamento pode ocorrer no Brasil e nos EUA, com salvaguardas técnicas, contratuais e organizacionais.
        </p>
      </Section>

      <Section id="seguranca" title="8. Segurança da informação">
        <ul>
          <li>Criptografia de senha com bcrypt.</li>
          <li>TLS em trânsito.</li>
          <li>Controles de acesso com menor privilégio.</li>
          <li>Logs e auditoria de eventos de segurança.</li>
          <li>Rate limiting e detecção de abuso.</li>
        </ul>
        <p>
          Risco zero não existe; notificaremos incidentes conforme a lei. Você é responsável por proteger suas credenciais
          e por avaliar seus próprios riscos em negociações com terceiros.
        </p>
      </Section>

      <Section id="retencao" title="9. Retenção e eliminação">
        <ul>
          <li>Conta e perfil: enquanto a conta estiver ativa.</li>
          <li>Anúncios e fotos: enquanto publicados e por até [X] meses após exclusão para logs/disputas.</li>
          <li>Mensagens: enquanto a conversa existir e por até [X] meses após exclusão para segurança.</li>
          <li>Logs técnicos: até 12 meses.</li>
          <li>Backups: rotação entre 30–90 dias.</li>
        </ul>
        <p>Eliminamos ou anonimizamos dados após os prazos, salvo obrigação legal.</p>
      </Section>

      <Section id="comunicacoes" title="10. Comunicações">
        <p>Enviamos mensagens transacionais sobre conta, segurança e serviço. Sem pagamentos e sem marketing sem sua escolha clara.</p>
      </Section>

      <Section id="menores" title="11. Privacidade de menores">
        <p>Serviço destinado a maiores de 13 anos. Pais/responsáveis podem solicitar exclusão por templesale.world@gmail.com.</p>
      </Section>

      <Section id="automatizadas" title="12. Decisões automatizadas">
        <p>Aplicamos detecções automáticas de abuso/spam. Você pode contestar via templesale.world@gmail.com.</p>
      </Section>

      <Section id="controles" title="13. Seus controles">
        <ul>
          <li>Editar perfil e localização.</li>
          <li>Revogar permissão de GPS no navegador.</li>
          <li>Solicitar download ou exclusão de dados.</li>
          <li>Excluir anúncios e mensagens pelos recursos disponíveis.</li>
        </ul>
      </Section>

      <Section id="alteracoes" title="14. Alterações nesta política">
        <p>Publicaremos novas versões com data de vigência. O uso contínuo indica ciência.</p>
      </Section>

      <Section id="contato" title="15. Contato">
        <p>templesale.world@gmail.com | Assunto: “Privacidade – TempleSale”.</p>
      </Section>

      <Section id="aviso" title="16. Aviso">
        <p>Este documento é um modelo informativo e não substitui assessoria jurídica.</p>
      </Section>

      <header id="termos">
        <h1>Termos de Uso – TempleSale</h1>
        <p className="legal-meta">Última atualização: 27 de outubro de 2025</p>
      </header>

      <Section id="aceite" title="1. Aceite">
        <p>Ao usar o TempleSale, você aceita estes Termos e as Diretrizes da Comunidade.</p>
      </Section>

      <Section id="servico" title="2. Serviço">
        <p>
          Classificados e chat. Não processamos pagamentos, não atuamos como garantidor e não participamos da negociação,
          entrega ou devolução. Você é o único responsável por avaliar risco e negociar diretamente com outros usuários.
        </p>
      </Section>

      <Section id="conta" title="3. Conta">
        <ul>
          <li>Use dados verdadeiros e mantenha apenas uma conta por pessoa.</li>
          <li>Proteja suas credenciais. Você responde por todo uso realizado.</li>
          <li>Podemos suspender/encerrar contas por violação ou risco à segurança.</li>
        </ul>
      </Section>

      <Section id="conteudo" title="4. Conteúdo do usuário">
        <p>
          Você mantém direitos sobre seu conteúdo, mas concede licença não exclusiva, mundial e gratuita ao TempleSale para
          hospedar e exibir seu conteúdo no serviço e em comunicações de produto.
        </p>
      </Section>

      <Section id="regras-anuncio" title="5. Regras de anúncio">
        <ul>
          <li>Informações corretas e atualizadas.</li>
          <li>Preços claros em moeda local.</li>
          <li>Proibidos itens/condutas vedadas nas Diretrizes.</li>
        </ul>
      </Section>

      <Section id="chat" title="6. Chat e negociações">
        <p>
          Use o chat com respeito. Não solicitamos pagamentos. Combine entrega/pagamento por sua conta e risco. Evite
          compartilhar dados sensíveis.
        </p>
      </Section>

      <Section id="seguranca-golpes" title="7. Segurança e golpes">
        <ul>
          <li>Desconfie de ofertas irreais.</li>
          <li>Prefira retirada local em local público.</li>
          <li>Não envie documentos nem adiante valores sem verificação.</li>
          <li>Denuncie atividades suspeitas.</li>
        </ul>
        <p>
          O TempleSale não responde por golpes ou prejuízos causados entre usuários. Você deve avaliar e mitigar os próprios
          riscos ao negociar.
        </p>
      </Section>

      <Section id="moderacao" title="8. Moderação e medidas">
        <p>Podemos remover conteúdo que viole regras ou a lei e aplicar restrições, suspensão ou banimento.</p>
      </Section>

      <Section id="responsabilidades" title="9. Responsabilidades">
        <p>
          O TempleSale não garante veracidade de anúncios, identidade de usuários, qualidade ou entrega. Não respondemos por
          perdas indiretas, lucros cessantes ou danos decorrentes do uso. Limite máximo de responsabilidade direta, quando
          aplicável e permitido por lei: maior entre R$ 500 ou US$ 100.
        </p>
      </Section>

      <Section id="propriedade" title="10. Propriedade intelectual">
        <p>Marcas, logotipos e código do TempleSale são protegidos. Não copie, faça engenharia reversa ou extraia dados em massa.</p>
      </Section>

      <Section id="privacidade-termos" title="11. Privacidade">
        <p>Regida pela Política de Privacidade acima.</p>
      </Section>

      <Section id="denuncia" title="12. Denúncia, notificações e contato">
        <p>Denúncias e notificações legais: templesale.world@gmail.com.</p>
      </Section>

      <Section id="legislacao" title="13. Legislação e foro">
        <p>
          Brasil: leis brasileiras e foro de [CIDADE/UF]. EUA: leis do estado de [ESTADO] e foro de [CIDADE/ESTADO].
          Consumidores podem ter foro garantido por lei local.
        </p>
      </Section>

      <Section id="alteracoes-termos" title="14. Alterações">
        <p>Podemos atualizar Termos; o uso contínuo indica aceitação.</p>
      </Section>

      <header id="diretrizes">
        <h1>Diretrizes da Comunidade e Política de Conteúdo – TempleSale</h1>
        <p className="legal-meta">Última atualização: 27 de outubro de 2025</p>
      </header>

      <Section id="principios" title="1. Princípios">
        <p>Respeito, legalidade, segurança, transparência em anúncios e tolerância zero a exploração/danos.</p>
      </Section>

      <Section id="proibidos" title="2. Conteúdos e itens proibidos">
        <p>
          Sexual (pornografia, nudez explícita, exploração, menores, incesto, bestialidade); violência e ódio (apologia,
          terrorismo, discurso de ódio, doxxing); ilegalidades (drogas, armas proibidas, explosivos, falsificação,
          contrabando, partes de animais protegidos); fraudes (pirâmides, golpes, phishing); segurança (instruções para
          crimes, compra de documentos, dados pessoais); saúde (medicamentos controlados, dispositivos regulados sem
          autorização); financeiro (clonagem, contas de terceiros, bases vazadas); privacidade (imagens íntimas sem
          consentimento); publicidade enganosa.
        </p>
      </Section>

      <Section id="restritos" title="3. Conteúdo restrito">
        <p>Álcool, tabaco, armas legalizadas, suplementos, peças automotivas críticas — exigimos conformidade legal local.</p>
      </Section>

      <Section id="boas-praticas" title="4. Boas práticas de anúncios">
        <p>Título claro, fotos reais, preço/estado informados, localização verdadeira, sem isca, sem reutilizar fotos alheias.</p>
      </Section>

      <Section id="chat-regras" title="5. Regras de comportamento no chat">
        <p>Sem insultos, assédio, ameaças, spam, links maliciosos, solicitações de dados sensíveis.</p>
      </Section>

      <Section id="medidas" title="6. Medidas de moderação">
        <p>Remoção de conteúdo, limites de função, suspensão temporária ou banimento definitivo.</p>
      </Section>

      <Section id="denunciar" title="7. Como denunciar">
        <p>Envie print, link do anúncio e descrição para templesale.world@gmail.com. Itens de risco imediato podem ser removidos sem aviso.</p>
      </Section>

      <Section id="contranotificacao" title="8. Procedimento de notificação/contranotificação">
        <p>
          Remoção por denúncia fundamentada ou ordem válida; notificamos o anunciante quando cabível; contranotificação por
          e-mail com defesa em até 7 dias; conteúdo pode ser reposto se aceito.
        </p>
      </Section>

      <Section id="antigolpe" title="9. Antigolpe: recomendações">
        <ul>
          <li>Desconfie de preços muito abaixo do mercado.</li>
          <li>Verifique o produto pessoalmente quando possível.</li>
          <li>Evite pagamentos antecipados e use métodos rastreáveis.</li>
          <li>Não compartilhe códigos de verificação nem senhas.</li>
          <li>Denuncie perfis suspeitos.</li>
        </ul>
      </Section>

      <Section id="reincidencia" title="10. Reincidência">
        <p>1ª ocorrência: remoção/aviso • 2ª: suspensão • 3ª: banimento • Casos graves: ban imediato.</p>
      </Section>

      <Section id="suplementos" title="Suplementos regionais e operacionais">
        <h3>Brasil – LGPD e comércio local</h3>
        <ul>
          <li>DPO: [NOME] – templesale.world@gmail.com</li>
          <li>Prazo respostas: até 15 dias</li>
          <li>Autoridade nacional: ANPD</li>
        </ul>
        <h3>EUA – CCPA/CPRA</h3>
        <ul>
          <li>Não vendemos dados pessoais.</li>
          <li>Direitos por templesale.world@gmail.com (prazo: até 45 dias).</li>
        </ul>
        <h3>Procedimentos operacionais (resumo público)</h3>
        <ul>
          <li>Solicitações de titulares: registrar, autenticar, atender no prazo.</li>
          <li>Incidentes: investigar, mitigar, notificar conforme lei.</li>
          <li>Preservação de evidências: retenção mínima e segura.</li>
          <li>Backups e restauração: rotação 30–90 dias.</li>
        </ul>
        <p>Contatos: Privacidade/DPO, Denúncias/Abuso, Jurídico — todos via templesale.world@gmail.com.</p>
      </Section>

      <footer className="legal-footer">
        <p>
          Se tiver dúvidas, fale conosco em <a href="mailto:templesale.world@gmail.com">templesale.world@gmail.com</a>.{' '}
          <Link to="/register">Voltar para cadastro</Link>
        </p>
      </footer>
    </div>
  );
}
