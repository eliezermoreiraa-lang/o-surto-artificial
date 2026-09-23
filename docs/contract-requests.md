# Contrate o Surto — real submissions

Deployed through Supabase SQL Editor: `supabase/sql/contract-requests.sql`.
The SQL is transactional and re-runnable. It does not change payment or auth flows.

## Flow

`contract-form.js` → `submit_contract_request` (invoker RPC) →
`surto_contact.submit` (narrow privileged implementation, non-exposed schema) →
`contract_requests` + existing `supporter_email_events`, committed atomically.

The existing `supporter-email-processor-every-10-minutes` cron sends through Resend,
using the existing verified sender and Vault credentials. No secrets are in the browser.
Recipient is fixed server-side to **osurtoartificial@gmail.com**. The applicant's
address appears in the message under **E-mail para responder**; the existing
processor's Reply-To is the site's inbox, so compose the reply to the applicant's
address, not by blindly using Reply in this notification.

## Guarantees and limits

- UI confirms **registration**, not email delivery; returns a protocol UUID.
- Form and queue writes roll back together if either fails.
- The caller cannot read requests, change destinations, or alter existing records.
- Anonymous submissions are intentional; no login required for a sales inquiry.
- Required-field and length validation runs server-side as well as in the UI.
- Honeypot and atomic limits: 3 submissions per email per hour, 30 total per hour.
  This is basic abuse mitigation, not a substitute for CAPTCHA under sustained attack.
- Retries reuse the request UUID + payload digest. Same UUID with changed data fails.
- Email queue uses deterministic idempotency keys and the existing 3-attempt retry
  schedule. Normal notifications can take up to 10 minutes before the first attempt.
- Existing queue limitations remain: permanently failed or stuck `sending` records
  need operator review. Requests remain saved even if notification delivery fails.
- No applicant auto-reply and no mailing-list enrollment were added.

## Verification

`node --test tests/contract-form.test.cjs` — validation, confirmed success,
failure preservation, duplicate click guard, same-ID retry, changed payload and Enter.

`tests/contract-requests.sql` — anonymous permissions, invalid payloads,
idempotency, conflicts and limits, all within a rolled-back transaction.

Read-only operations check (run as database administrator):

```sql
select r.id, r.created_at, e.status, e.attempts, e.sent_at,
       e.provider_message_id, e.last_error
from public.contract_requests r
join public.supporter_email_events e on e.id = r.email_event_id
order by r.created_at desc limit 50;
```

`sent` means the provider accepted the email. Check Resend delivery status or
recipient inbox separately before claiming delivery. Do not blindly replay a
`sending` email outside Resend's idempotency window; verify its provider status first.

The old form only displayed a success toast, so earlier submissions were not stored
by that handler and cannot be recovered from this new table.
