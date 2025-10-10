-- public.photos
-- depends on: places(id), reviews(id), auth_user(id)
CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id uuid REFERENCES public.places(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.reviews(id) ON DELETE CASCADE,
  uploaded_by bigint NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  width int,
  height int,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_photos_place ON public.photos (place_id, created_at DESC);
CREATE INDEX idx_photos_review ON public.photos (review_id, created_at DESC);
