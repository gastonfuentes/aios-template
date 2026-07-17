# Generar VAPID keys

VAPID (Voluntary Application Server Identification) identifica tu server al push service. Sin esas keys, los browsers rechazan tu envio.

## Generar (una sola vez)

```bash
npx web-push generate-vapid-keys
```

Salida:

```
Public Key: BLab... (88 chars base64url)
Private Key: 8z... (43 chars base64url)
```

## Variables de entorno

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BLab...
VAPID_PRIVATE_KEY=8z...
VAPID_SUBJECT=mailto:tu@dominio.com
```

`NEXT_PUBLIC_*` porque la public key se usa desde el cliente para subscribe. Private key solo server-side.
`VAPID_SUBJECT` es un identificador de contacto (mailto: o https://) que el push service ve si tu envio falla — para reportarte.

## Rotacion de keys

Si necesitas cambiar las VAPID keys (compromiso, error de generacion):

1. Generar nuevas con el comando.
2. Reemplazar variables en server.
3. Forzar a TODOS los clientes a re-suscribirse (sus subs viejas usan la public key vieja → invalidas).
4. Borrar todas las filas de `push_subscriptions`.

Mensaje al usuario: "Renovamos nuestras notificaciones. Vuelve a activarlas en Ajustes."

## Chequeo

```ts
// scripts/check-vapid.ts
console.log('Public:', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.length); // 88
console.log('Private:', process.env.VAPID_PRIVATE_KEY?.length); // 43
console.log('Subject:', process.env.VAPID_SUBJECT); // mailto:... o https://...
```

Si los lengths no coinciden, las keys estan mal copiadas.
