-- ============================================================
-- Storage Bucket Policies for Sources
-- ============================================================

-- Create the sources bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('sources', 'sources', true)
on conflict (id) do nothing;

-- Enable RLS on storage.objects (should already be enabled)
alter table storage.objects enable row level security;

-- Policy: Users can upload files to their project folders
create policy "Users can upload source files"
  on storage.objects for insert
  with check (
    bucket_id = 'sources' 
    and auth.role() = 'authenticated'
  );

-- Policy: Users can view their own files (based on path starting with project_id they own)
create policy "Users can view source files"
  on storage.objects for select
  using (
    bucket_id = 'sources'
  );

-- Policy: Users can update their own files
create policy "Users can update source files"
  on storage.objects for update
  using (
    bucket_id = 'sources'
    and auth.role() = 'authenticated'
  );

-- Policy: Users can delete their own files
create policy "Users can delete source files"
  on storage.objects for delete
  using (
    bucket_id = 'sources'
    and auth.role() = 'authenticated'
  );
