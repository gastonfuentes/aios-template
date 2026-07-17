# Adaptacion: React Native + Expo

Supabase Auth funciona igual en Expo. Diferencias clave:

1. **Storage de sesion**: usa `AsyncStorage` (`@react-native-async-storage/async-storage`) en lugar de cookies.

   ```ts
   import AsyncStorage from '@react-native-async-storage/async-storage';
   import { createClient } from '@supabase/supabase-js';

   export const supabase = createClient(
     process.env.EXPO_PUBLIC_SUPABASE_URL!,
     process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
     {
       auth: {
         storage: AsyncStorage,
         autoRefreshToken: true,
         persistSession: true,
         detectSessionInUrl: false,
       },
     },
   );
   ```

2. **Magic-link deep linking**: configura un universal link / app scheme en `app.json`:

   ```json
   { "expo": { "scheme": "tuapp" } }
   ```

   Y en `signInWithOtp`: `emailRedirectTo: 'tuapp://auth/callback'`.

3. **No hay middleware** — la proteccion es por hooks en el navigator:

   ```tsx
   // App.tsx
   const { data: { session } } = await supabase.auth.getSession();
   return session ? <AppNavigator /> : <AuthNavigator />;
   ```

4. **RLS y profiles**: identico al setup de Next.js. Misma migracion del Paso 1.

Cross-ref `@.claude/skills/pwa-mobile/SKILL.md` para considerar PWA antes que Expo si el alumno solo quiere "que se instale en el telefono".
