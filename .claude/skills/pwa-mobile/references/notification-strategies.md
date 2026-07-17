# Notification strategies — push vs email vs ambos

## Decision matrix

| Caso | Push | Email | Ambos |
|---|---|---|---|
| Cobro confirmado | ✓ instant | ✓ recibo legal | ✓ |
| Cancelacion procesada | ✓ instant | ✓ confirmacion | ✓ |
| Nueva leccion publicada | ✓ instant | — (ruido) | — |
| Membresia expirando 3 dias | — | ✓ accion requerida | — |
| Welcome al alumno | — | ✓ contexto inicial | — |
| Broadcast a comunidad | — | ✓ formato detallado | — |
| Mensaje directo en app | ✓ instant | — | — |

## Reglas operativas

1. **Push: maximo 3-5 por usuario por semana**. Mas de eso = notification fatigue, los usuarios disable. Excepcion: chat directo donde el usuario opt-in explicito a cada mensaje.
2. **Email: maximo 1 por dia operacional**. Mas de eso, el alumno marca spam y ese es bidireccional con el dominio.
3. **Push sin email backup**: solo si el evento es ephemero (mensaje chat). Para eventos importantes (cobro, cancelacion), siempre tener email como fallback en caso de push perdido.

## Opt-in granular

En `/(app)/settings/notifications`:

```tsx
<div className="space-y-4">
  <SettingToggle
    label="Notificaciones push"
    description="Avisos instantaneos en tu telefono"
    value={settings.push_enabled}
    onChange={(v) => updateSettings({ push_enabled: v })}
  />
  {settings.push_enabled && (
    <>
      <SettingToggle label="Cobros y suscripciones" value={settings.push_billing} />
      <SettingToggle label="Nuevo contenido" value={settings.push_content} />
      <SettingToggle label="Mensajes directos" value={settings.push_messages} />
    </>
  )}
</div>
```

Opt-in granular reduce el churn de "desactivo todo porque me llegan demasiados". El usuario controla que canales recibir.

## Frecuencia para broadcast

Para anunciar "nueva leccion": batch toda la cola del dia y enviar push consolidado al final ("Hoy publicamos 3 lecciones nuevas"). Razon: 3 push consecutivos en 1 hora se siente spammy aunque cada uno este justificado.

## Dead subscriptions

Limpiar `push_subscriptions` viejas:

```sql
-- Subs sin actividad de 90+ dias = probablemente desinstalada
delete from public.push_subscriptions
where created_at < now() - interval '90 days'
  and not exists (
    select 1 from public.push_logs l
    where l.subscription_id = push_subscriptions.id
      and l.created_at >= now() - interval '30 days'
  );
```

Sin limpieza, intentas enviar a subs invalidas → degradacion del rate de delivery del browser.
