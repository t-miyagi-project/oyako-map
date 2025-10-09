-- public.reviews
-- depends on: places(id), auth_user(id), age_bands(id)
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_id uuid NOT NULL REFERENCES public.places(id) ON DELETE CASCADE,
  user_id bigint NOT NULL REFERENCES public.auth_user(id) ON DELETE CASCADE,
  overall smallint NOT NULL,
  age_band_id uuid REFERENCES public.age_bands(id),
  stay_minutes int,
  revisit_intent smallint,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reviews_place_created ON public.reviews (place_id, created_at DESC);
