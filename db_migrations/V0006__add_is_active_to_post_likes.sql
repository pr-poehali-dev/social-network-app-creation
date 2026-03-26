ALTER TABLE t_p19897573_social_network_app_c.post_likes
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE t_p19897573_social_network_app_c.post_likes
  DROP CONSTRAINT IF EXISTS post_likes_post_id_user_id_key;

ALTER TABLE t_p19897573_social_network_app_c.post_likes
  ADD CONSTRAINT post_likes_post_id_user_id_key UNIQUE (post_id, user_id);