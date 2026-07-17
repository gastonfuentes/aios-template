# Storage policies para buckets de imagenes

## Bucket `avatars` (publico, una imagen por user)

```sql
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);
```

`public = true` significa que cualquier URL del bucket es accesible sin signed URL. Apropiado para avatares (no son sensitive).

Policies:

```sql
-- Solo el dueno puede subir/actualizar su carpeta
create policy "avatars_user_upload" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_user_update" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars_user_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Public read (bucket es publico, esto es complementario)
-- No policy de select necesaria — bucket public.
```

Path convention: `<user-id>/<filename>.webp`.

## Bucket `assets` (publico, contenido del creator)

Para imagenes generadas que el creator usa en su producto (thumbnails de cursos, banners, etc.):

```sql
insert into storage.buckets (id, name, public)
values ('assets', 'assets', true);

-- Solo creators y admins pueden subir
create policy "assets_creator_upload" on storage.objects
  for insert with check (
    bucket_id = 'assets'
    and exists(
      select 1 from public.profiles
      where id = auth.uid() and role in ('creator', 'admin')
    )
  );
```

## Bucket `private-uploads` (privado, requiere signed URL)

Para casos sensibles: ID scans, contracts, evidencia.

```sql
insert into storage.buckets (id, name, public)
values ('private-uploads', 'private-uploads', false);

create policy "private_user_upload" on storage.objects
  for insert with check (
    bucket_id = 'private-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "private_user_read" on storage.objects
  for select using (
    bucket_id = 'private-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
```

Acceso desde frontend:

```ts
const { data } = await supabase.storage
  .from('private-uploads')
  .createSignedUrl('uuid/file.pdf', 3600); // 1 hora

console.log(data.signedUrl);
```

## Limites recomendados

Supabase free tier: 1GB de storage. Plan paid: 100GB.

Limites operativos sugeridos:

- Avatar por user: 1 archivo, max 500KB tras WebP optimization.
- Assets per creator: max 50 archivos en plan basico.
- Private uploads: cleanup automatico a 90 dias via Edge Function programada.

## Cleanup automatico

```ts
// supabase/functions/cleanup-old-private/index.ts
import { createClient } from 'jsr:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const { data: files } = await supabase.storage.from('private-uploads').list('', {
  limit: 1000,
  sortBy: { column: 'created_at', order: 'asc' },
});

const cutoff = Date.now() - 90 * 24 * 3600 * 1000;
const toDelete = files
  ?.filter((f) => new Date(f.created_at).getTime() < cutoff)
  .map((f) => f.name) ?? [];

if (toDelete.length > 0) {
  await supabase.storage.from('private-uploads').remove(toDelete);
}
```

Programar via `pg_cron` cada 24h. Cross-ref `@.claude/skills/supabase-admin/references/edge-functions.md`.
