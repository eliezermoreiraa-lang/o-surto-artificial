# Clube do Surto — campanha até 5 de outubro de 2026

- Janela de novas contratações: 25/09/2026 a 05/10/2026 inclusive, horário de Brasília.
- Apoiador R$ 25, Destaque R$ 50, VIP R$ 150; Apoio Livre não participa.
- Avulso: desconto aplicado pelo servidor durante a campanha.
- Mensal: o contrato armazena o valor promocional. Todas as renovações usam esse mesmo valor enquanto a assinatura continuar; o fim da campanha não altera contratos.
- Cancelar e contratar novamente usa a oferta vigente. Contratos e apoios anteriores não são atualizados.
- O consentimento inclui o valor exibido; divergências de preço são rejeitadas antes de criar cobrança.
- O banner e os preços promocionais somem para novas contratações após o prazo, sem tarefa agendada.

## Verificação

`node --test tests/promotion.test.mjs tests/monthly-support.test.mjs tests/asaas-production.test.mjs`

Testes usam respostas simuladas do Asaas e não geram débitos. Conferência de produção sem escrita financeira: `tests/monthly-production-smoke.mjs`.

## Publicação

Publicar funções `asaas-monthly-support`, `asaas-create-support-payment` e `supporter-dashboard-data` junto de seus módulos locais; depois publicar o site. Não alterar os preços-base da tabela `support_plans` nem contratos já criados.
