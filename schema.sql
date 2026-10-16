-- Esquema inicial para o TCC. Execute uma vez no SQL Editor do projeto novo.
-- Os comprovantes ficam em Storage privado; a tabela guarda somente o caminho.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create table if not exists private.admin_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    authorized_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from private.admin_users a
        where a.user_id = (select auth.uid())
    );
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

create table if not exists public.inscricoes (
    id uuid primary key,
    nome text not null check (char_length(btrim(nome)) between 2 and 120),
    whatsapp text not null check (whatsapp ~ '^[0-9()+ .-]{8,25}$'),
    curso text not null check (curso in ('Formatos & Naturalidade', 'Formatos & NailArt')),
    duvida text not null default '' check (char_length(duvida) <= 2000),
    comprovante_path text,
    status text not null default 'aguardando' check (status in ('aguardando', 'pago', 'confirmado')),
    criada_em timestamptz not null default now(),
    constraint inscricoes_comprovante_path_valido check (
        comprovante_path is null or
        comprovante_path ~ ('^' || id::text || '/comprovante\.(jpg|png|webp)$')
    )
);

alter table public.inscricoes enable row level security;
revoke all on public.inscricoes from public, anon, authenticated;
grant select on public.inscricoes to authenticated;
grant update (status) on public.inscricoes to authenticated;

drop policy if exists "Administradora le inscricoes" on public.inscricoes;
create policy "Administradora le inscricoes"
    on public.inscricoes for select to authenticated
    using ((select private.is_admin()));

drop policy if exists "Administradora altera status" on public.inscricoes;
create policy "Administradora altera status"
    on public.inscricoes for update to authenticated
    using ((select private.is_admin()))
    with check ((select private.is_admin()));

-- A funcao recebe somente os dados publicos do formulario e fixa status aguardando.
-- Repetir o mesmo UUID de tentativa nao cria uma segunda inscricao.
create or replace function public.enviar_inscricao(
    p_id uuid,
    p_nome text,
    p_whatsapp text,
    p_curso text,
    p_duvida text,
    p_comprovante_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
    if p_id is null
       or p_nome is null or char_length(btrim(p_nome)) not between 2 and 120
       or p_whatsapp is null or p_whatsapp !~ '^[0-9()+ .-]{8,25}$'
       or p_curso not in ('Formatos & Naturalidade', 'Formatos & NailArt')
       or coalesce(char_length(p_duvida), 0) > 2000 then
        raise exception 'Dados da inscricao invalidos';
    end if;

    if p_comprovante_path is not null
       and p_comprovante_path !~ ('^' || p_id::text || '/comprovante\.(jpg|png|webp)$') then
        raise exception 'Caminho de comprovante invalido';
    end if;

    insert into public.inscricoes (id, nome, whatsapp, curso, duvida, comprovante_path, status)
    values (p_id, btrim(p_nome), btrim(p_whatsapp), p_curso, coalesce(btrim(p_duvida), ''), p_comprovante_path, 'aguardando')
    on conflict (id) do nothing;

    return p_id;
end;
$$;
revoke all on function public.enviar_inscricao(uuid, text, text, text, text, text) from public;
grant execute on function public.enviar_inscricao(uuid, text, text, text, text, text) to anon, authenticated;

create or replace function public.sou_administradora()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select private.is_admin();
$$;
revoke all on function public.sou_administradora() from public, anon;
grant execute on function public.sou_administradora() to authenticated;

-- Buckets guardam limite de 5 MiB e os MIME permitidos no lado do Storage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
    name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Visitantes enviam comprovante" on storage.objects;
create policy "Visitantes enviam comprovante"
    on storage.objects for insert to anon, authenticated
    with check (
        bucket_id = 'comprovantes'
        and name ~ '^[0-9a-fA-F-]{36}/comprovante\.(jpg|png|webp)$'
    );

drop policy if exists "Administradora le comprovantes" on storage.objects;
create policy "Administradora le comprovantes"
    on storage.objects for select to authenticated
    using (bucket_id = 'comprovantes' and (select private.is_admin()));

drop policy if exists "Administradora apaga comprovantes" on storage.objects;
create policy "Administradora apaga comprovantes"
    on storage.objects for delete to authenticated
    using (bucket_id = 'comprovantes' and (select private.is_admin()));
