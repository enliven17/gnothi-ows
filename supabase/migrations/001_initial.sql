-- Oracle deployments: tracks GenLayer tx hash per market contract
-- Used by AIConsole to poll validator consensus in real-time
create table if not exists oracle_deployments (
    contract_address text primary key,
    tx_hash          text not null,
    oracle_address   text not null,
    deployed_at      timestamptz not null default now()
);

-- Resolution jobs: scheduled auto-resolution queue
-- Replaces file-based storage so Railway restarts don't lose pending jobs
create table if not exists resolution_jobs (
    id               text primary key,
    contract_address text not null,
    end_date         timestamptz not null,
    market_title     text not null,
    status           text not null default 'pending',  -- pending | scheduled | completed | failed
    created_at       timestamptz not null default now(),
    executed_at      timestamptz,
    error_message    text
);

create index if not exists idx_resolution_jobs_status on resolution_jobs (status);
create index if not exists idx_resolution_jobs_end_date on resolution_jobs (end_date);
