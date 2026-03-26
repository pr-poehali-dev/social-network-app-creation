ALTER TABLE t_p19897573_social_network_app_c.followers
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE t_p19897573_social_network_app_c.followers
  DROP CONSTRAINT IF EXISTS followers_follower_id_following_id_key;

ALTER TABLE t_p19897573_social_network_app_c.followers
  ADD CONSTRAINT followers_follower_id_following_id_key UNIQUE (follower_id, following_id);