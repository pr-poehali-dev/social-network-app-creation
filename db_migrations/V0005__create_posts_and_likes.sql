CREATE TABLE IF NOT EXISTS t_p19897573_social_network_app_c.posts (
    id bigserial PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    text text NOT NULL,
    likes_count integer NOT NULL DEFAULT 0,
    comments_count integer NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS t_p19897573_social_network_app_c.post_likes (
    id bigserial PRIMARY KEY,
    post_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.posts(id),
    user_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE (post_id, user_id)
);