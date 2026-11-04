-- ─────────────────────────────────────────────────────────────────────────────
-- schema.sql — 계정별 검사 이력. Supabase(Postgres) 기준.
--
-- 통제를 앱의 if 문으로 하지 않는다. 데스크톱 앱의 분기는 우회된다.
-- 이력과 보고서가 여기 있으면 로그인 없이는 쓸 이유가 없어진다 — 그게 작동하는 통제다.
--
-- 격리는 RLS 로 선언한다. 앱이 WHERE 절을 빠뜨려도 남의 줄이 보이지 않는다.
-- owner 를 세 표에 모두 두는 이유는 정책 평가에 조인을 끌어오지 않기 위해서다.
-- ─────────────────────────────────────────────────────────────────────────────

-- 검수 대상 한 건 — 외주사 하나, 사이트 하나
create table public.projects (
  id         uuid primary key default gen_random_uuid(),
  owner      uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

-- 한 차례의 검사. 1차 · 2차 대조의 단위다
create table public.scans (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  owner      uuid not null references auth.users (id) on delete cascade,
  url        text not null,
  -- 어떤 기준으로 쟀는지 함께 남긴다 — 기준이 바뀐 뒤의 대조는 대조가 아니다
  options    jsonb not null,
  scanned    integer not null,
  at         timestamptz not null default now()
);

-- 검사 결과 한 건. 스크린샷은 올리지 않는다 — 고객사 화면이 서버에 남지 않게 한다
create table public.findings (
  id        bigserial primary key,
  scan_id   uuid not null references public.scans (id) on delete cascade,
  owner     uuid not null references auth.users (id) on delete cascade,
  verdict   text not null check (verdict in ('fail', 'undeterminable', 'allowed')),
  ratio     numeric,
  required  numeric not null,
  large     boolean not null,
  selector  text not null,
  fg        text not null,
  bg        text,
  -- 'text' 는 예약어와 헷갈리므로 snippet 으로 둔다
  snippet   text not null,
  font      jsonb not null
);

-- 대조는 "같은 프로젝트 · 같은 URL 의 최근 두 차례" 를 읽는다
create index scans_recent on public.scans (project_id, url, at desc);
create index findings_by_scan on public.findings (scan_id);

alter table public.projects enable row level security;
alter table public.scans    enable row level security;
alter table public.findings enable row level security;

-- 자기 줄만 읽고 쓴다. anon 키가 공개되어도 이 정책이 막는다
create policy own_projects on public.projects for all
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy own_scans on public.scans for all
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy own_findings on public.findings for all
  using (owner = auth.uid()) with check (owner = auth.uid());
