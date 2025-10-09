-- public.review_axes
CREATE TABLE public.review_axes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  sort int NOT NULL DEFAULT 100
);
