# Apoio mensal no cartão

Planos: Apoiador R$ 50/mês, Destaque R$ 100/mês, VIP R$ 300/mês. Apoio Livre permanece avulso e sem login obrigatório. Não há migração automática de apoios existentes nem crédito de upgrade aplicado à mensalidade.

Fluxo: Clube → login existente → consentimento desmarcado por padrão → `asaas-monthly-support` → Asaas Checkout `CREDIT_CARD / RECURRENT / MONTHLY`. CPF e cartão são preenchidos no Asaas, sem captura de PAN/CVV pelo site. Retorno de navegador não confirma pagamento.

Assinaturas são únicas por conta enquanto pendentes/ativas/em atraso. Cliques repetidos reutilizam o checkout. Timeout ambíguo mantém o contrato bloqueado para evitar duplicidade; `CHECKOUT_CREATED` recupera o ID pela referência `monthly:<uuid>`. Em caso de falha de integração sem esse evento, consultar o checkout no Asaas antes de liberar uma nova contratação. Nunca repetir um POST financeiro cegamente.

O webhook valida o token de produção, consulta o estado atual do pagamento/assinatura e grava cada mensalidade em uma transação. O mesmo pagamento tem um único apoio. Cada mensalidade paga gera uma aparição própria; avisos de pagamento duplicados não geram nova aparição. Cobranças futuras/recusadas não liberam benefícios nem entram no recebido. O mural e a meta de tokens usam os mesmos triggers dos apoios. Renovação avulsa por e-mail exclui assinantes em andamento.

`Minha Assinatura` mostra status, valor e próximo vencimento; permite retomar checkout e cancelar. DELETE no Asaas precede o cancelamento local; histórico pago é preservado. Se houver falha, a UI não afirma que cancelou. Um checkout recém-pago pode exigir aguardar sua sincronização antes do cancelamento.

Admin: visão geral inclui contratos/status/próximo vencimento; total mensal contratado é explicitamente previsão, separado dos recebimentos reais.

Backend usa `auth.getUser` antes de qualquer operação e filtro de propriedade no cancelamento. Gateway JWT legado desativado nas funções com validação interna, compatível com chaves modernas. RPC de conciliação só pode ser executada por service_role, com RLS e permissões restritas. Segredos somente em Edge Functions.

## Verificações realizadas

- 44 testes Node: pagamentos existentes, apoio livre, assinatura, autorização, idempotência, falha, cancelamento e vínculo de eventos.
- SQL transacional com rollback: mensalidades, duplicatas, aparições, atraso, evento antigo, cancelamento e permissões. Nenhum registro de teste permanece.
- Chrome/WebKit, 390 e 1440 px: intenção após login, consentimento, checkout, próximo vencimento e confirmação do cancelamento. Transporte financeiro simulado.
- API real Asaas: checkout recorrente criado e cancelado no Sandbox, HTTP 200; ciclo MONTHLY confirmado. Nenhum cartão processado.
- Produção: API conectada, webhook atualizado com eventos mensais preservando os eventos avulsos. Testes negativos rejeitam usuário sem sessão e webhook sem token.
- Nenhuma assinatura/ cobrança real foi criada pelo teste. Primeiro pagamento e futuro débito real dependem da autorização do cliente e aprovação do emissor.

Fontes: https://docs.asaas.com/docs/checkout-com-assinatura-recorrente ; https://docs.asaas.com/reference/criar-novo-checkout ; https://docs.asaas.com/docs/eventos-para-assinaturas ; https://docs.asaas.com/docs/faq-assinaturas .
