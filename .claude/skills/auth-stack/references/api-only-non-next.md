# Adaptacion: backend-only / API-only

Caso: el alumno construye una API REST/GraphQL sin frontend (consumidor mobile, terceros).

Setup:

- Cliente server-side con service-role o anon segun endpoint:

  ```ts
  import { createClient } from '@supabase/supabase-js';

  export const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  );
  ```

- Auth via JWT — el cliente envia `Authorization: Bearer <access_token>`. El servidor lo valida llamando a `auth.getUser(token)`:

  ```ts
  app.use(async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).end();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).end();
    req.user = user;
    next();
  });
  ```

- RLS sigue activa para los queries que el server hace en nombre del user. Si necesitas saltarte RLS (operacion admin), usa el client con service-role en una funcion separada.

- Migracion `profiles` y trigger de `handle_new_user` se mantienen identicos.

El flujo de signin lo hace el cliente (mobile, SPA externa) directo contra Supabase. El backend solo valida tokens entrantes.
