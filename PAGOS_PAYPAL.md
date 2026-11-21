# Pagos con PayPal (suscripción mensual)

Flujo: el usuario pulsa el botón de PayPal en el modal de planes → aprueba la suscripción →
la función `paypal-activate` comprueba el pago directamente con PayPal y sube `app_metadata.plan` →
si luego cancela o falla el cobro, `paypal-webhook` lo devuelve a Básico.

## 1. Crear los planes en PayPal
1. Entra a <https://developer.paypal.com> con tu cuenta **Business** → *Apps & Credentials*.
2. Empieza en **Sandbox** para probar; luego repites en **Live**.
3. *Create App* → copia **Client ID** y **Secret**.
4. En <https://www.paypal.com/billing/plans> (Live) o la sección *Subscriptions* del sandbox crea un **producto** "Global Zion Social Manager"
   y **tres planes mensuales** en USD, sin periodo de prueba en PayPal (la prueba de 15 días la controla la app): Básico 6.65, PRO 15.11 y PRO PLUS 26.74 (`PRICES` en `src/lib/plans.js`). Son los precios que paga el cliente; incluyen la comisión de PayPal en Chile (5,40 % + 0,30 USD) para que te lleguen netos 5.99 / 13.99 / 24.99.
   Copia los IDs `P-XXXXXXXX` de cada uno.

## 2. Webhook
En la app de PayPal → *Webhooks* → *Add webhook*:
- URL: `https://axshbrskybmydywwpdla.supabase.co/functions/v1/paypal-webhook`
- Eventos: `BILLING.SUBSCRIPTION.ACTIVATED`, `CANCELLED`, `SUSPENDED`, `EXPIRED` y `BILLING.SUBSCRIPTION.PAYMENT.FAILED`.
- Copia el **Webhook ID**.

## 3. Secretos y despliegue (Supabase)
```
supabase secrets set PAYPAL_CLIENT_ID=... PAYPAL_SECRET=... PAYPAL_PLAN_BASIC=P-... PAYPAL_PLAN_PRO=P-... PAYPAL_PLAN_PRO_PLUS=P-... PAYPAL_WEBHOOK_ID=... --project-ref axshbrskybmydywwpdla
# Solo para pruebas: supabase secrets set PAYPAL_ENV=sandbox --project-ref axshbrskybmydywwpdla
supabase functions deploy paypal-activate --project-ref axshbrskybmydywwpdla
supabase functions deploy paypal-webhook --no-verify-jwt --project-ref axshbrskybmydywwpdla
```

## 4. Variables del frontend
En `.env` local y en el hosting (el Client ID y los planes son públicos por diseño):
```
VITE_PAYPAL_CLIENT_ID=...
VITE_PAYPAL_PLAN_BASIC=P-...
VITE_PAYPAL_PLAN_PRO=P-...
VITE_PAYPAL_PLAN_PRO_PLUS=P-...
```
Mientras falte alguna, los botones no aparecen y el modal sigue diciendo «escríbenos».

## Notas
- Sandbox y Live tienen credenciales y planes distintos: no mezcles Client ID de uno con planes del otro.
- Subir de PRO a PRO PLUS cancela automáticamente la suscripción PRO anterior.
- El usuario cancela desde su cuenta de PayPal (Pagos automáticos); el webhook lo baja a Básico.
- Prueba gratuita: 15 días desde que se crea la cuenta (los usuarios anteriores al 2026-11-21 cuentan desde esa fecha). Al terminar, la app se bloquea con el modal de planes hasta suscribirse; el dueño y los administradores no caducan. La función `social` también lo exige en el servidor.

## Planes ya creados en tu PayPal (Live)
| Plan | ID | Precio |
|---|---|---|
| Básico | `P-1PS67168M2788160ENMBBNZA` | 6.65 USD/mes |
| PRO | `P-6YC01670TX349870CNMBBOLQ` | 15.11 USD/mes |
| PRO PLUS | `P-0AA870399H830763ENMBBO5Q` | 26.74 USD/mes |

Producto: `PROD-6A274669SR002204K`. El plan antiguo de Básico a 5.99 (`P-1N782334AR181151GNMBBLOY`) está desactivado.
