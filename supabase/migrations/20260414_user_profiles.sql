-- 1. Crear la tabla de perfiles
create table if not exists public.perfiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  avatar text,
  rol text default 'usuario' check (rol in ('usuario', 'superadmin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Habilitar RLS (Seguridad)
alter table public.perfiles enable row level security;

-- 3. Políticas de acceso
create policy "Perfiles visibles para todos" on perfiles for select using (true);
create policy "Usuarios editan su propio perfil" on perfiles for update using (auth.uid() = id);
create policy "Superadmin edita cualquier perfil" on perfiles for all using (
  exists (select 1 from perfiles where id = auth.uid() and rol = 'superadmin')
);

-- 4. Función y Trigger para sincronizar usuarios automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.perfiles (id, email, display_name, rol)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case when new.email = 'masio.tds@gmail.com' then 'superadmin' else 'usuario' end
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Backfill
insert into public.perfiles (id, email, display_name, rol)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'display_name', split_part(email, '@', 1)),
  case when email = 'masio.tds@gmail.com' then 'superadmin' else 'usuario' end
from auth.users
on conflict (id) do nothing;
