# Modelos de e-mail do Supabase Auth

Cópia versionada dos modelos configurados no painel do Supabase — eles **só valem
depois de colados lá**: Authentication → Email Templates
(https://supabase.com/dashboard/project/yzbgjhstwylnmhquxalq/auth/templates).

| Modelo no painel | Arquivo | Assunto | Quando sai |
|---|---|---|---|
| Confirm signup | `confirm-signup.html` | `Confirme seu e-mail — Studio Paper` | e-mail novo em `/entrar` (`signUp`) |
| Magic Link | `magic-link.html` | `Continue seu cadastro na Studio Paper` | conta confirmada sem cadastro completo (`signInWithOtp`) |
| Reset Password | `reset-password.html` | `Crie uma nova senha — Studio Paper` | "Esqueci minha senha" no login (`resetPasswordForEmail`) → `/redefinir-senha?token_hash=…&type=recovery` |

Os links usam `?token_hash={{ .TokenHash }}&type=email` → `/completar-cadastro`, que
confirma com `verifyOtp` (funciona em qualquer navegador; ver CLAUDE.md). Ao editar,
trocar o link inteiro — sobrar `{{ ` / ` }}` quebra o modelo.

Os demais modelos (Change Email, Invite, Reauthentication) não são
disparados pelo site hoje.
