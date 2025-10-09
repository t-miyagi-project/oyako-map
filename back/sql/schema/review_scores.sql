-- public.review_scores
-- depends on: reviews(id), review_axes(id)
CREATE TABLE public.review_scores (
  id bigserial PRIMARY KEY,
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  axis_id uuid NOT NULL REFERENCES public.review_axes(id) ON DELETE CASCADE,
  score smallint NOT NULL
);

CREATE UNIQUE INDEX review_scores_review_axis_uniq ON public.review_scores (review_id, axis_id);
