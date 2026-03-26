CREATE TABLE IF NOT EXISTS t_p19897573_social_network_app_c.followers (
    id bigserial PRIMARY KEY,
    follower_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    following_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS t_p19897573_social_network_app_c.chats (
    id bigserial PRIMARY KEY,
    user1_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    user2_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE (user1_id, user2_id)
);

CREATE TABLE IF NOT EXISTS t_p19897573_social_network_app_c.messages (
    id bigserial PRIMARY KEY,
    chat_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.chats(id),
    sender_id bigint NOT NULL REFERENCES t_p19897573_social_network_app_c.users(id),
    text text NOT NULL,
    created_at timestamptz DEFAULT now(),
    read_at timestamptz NULL
);