import { useState } from "react";
import Icon from "@/components/ui/icon";

interface AuthUser {
  id: number;
  phone: string;
  name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
}

interface IndexProps {
  currentUser: AuthUser;
  token: string;
  onLogout: () => void;
}

const STORIES = [
  { id: 1, user: "Виктория", username: "@viktoria", avatar: "ВМ", seen: false, color: "from-rose-800 to-amber-700" },
  { id: 2, user: "Артём", username: "@artem", avatar: "АК", seen: false, color: "from-indigo-800 to-purple-700" },
  { id: 3, user: "Диана", username: "@diana", avatar: "ДС", seen: true, color: "from-emerald-800 to-teal-700" },
  { id: 4, user: "Михаил", username: "@misha", avatar: "МП", seen: true, color: "from-slate-700 to-zinc-600" },
  { id: 5, user: "Лера", username: "@lera", avatar: "ЛН", seen: false, color: "from-amber-800 to-orange-700" },
];

const INITIAL_POSTS = [
  {
    id: 1,
    user: "Виктория М.",
    username: "@viktoria",
    avatar: "ВМ",
    avatarColor: "from-rose-800 to-amber-700",
    time: "2 ч назад",
    text: "Только что вернулась из Флоренции. Город, где каждый камень — история. Архитектура, свет, вино и бесконечное ощущение вечности.",
    likes: 284,
    comments: 18,
    liked: false,
    saved: false,
  },
  {
    id: 2,
    user: "Артём К.",
    username: "@artem",
    avatar: "АК",
    avatarColor: "from-indigo-800 to-purple-700",
    time: "5 ч назад",
    text: "Новый проект. Новая глава. Благодарен каждому, кто был рядом в пути. Иногда лучший следующий шаг — это прыжок.",
    likes: 512,
    comments: 43,
    liked: true,
    saved: true,
  },
  {
    id: 3,
    user: "Диана С.",
    username: "@diana",
    avatar: "ДС",
    avatarColor: "from-emerald-800 to-teal-700",
    time: "вчера",
    text: "Утро начинается с тишины, хорошего эспрессо и осознания, что всё идёт именно так, как должно.",
    likes: 196,
    comments: 9,
    liked: false,
    saved: false,
  },
];

const NOTIFICATIONS = [
  { id: 1, type: "like", user: "Виктория М.", avatar: "ВМ", color: "from-rose-800 to-amber-700", text: "оценила вашу публикацию", time: "3 мин", read: false },
  { id: 2, type: "follow", user: "Артём К.", avatar: "АК", color: "from-indigo-800 to-purple-700", text: "подписался на вас", time: "15 мин", read: false },
  { id: 3, type: "comment", user: "Диана С.", avatar: "ДС", color: "from-emerald-800 to-teal-700", text: "прокомментировала: «Прекрасно написано!»", time: "1 ч", read: true },
  { id: 4, type: "like", user: "Михаил П.", avatar: "МП", color: "from-slate-700 to-zinc-600", text: "оценил вашу публикацию", time: "2 ч", read: true },
  { id: 5, type: "follow", user: "Лера Н.", avatar: "ЛН", color: "from-amber-800 to-orange-700", text: "подписалась на вас", time: "вчера", read: true },
];

const CHATS = [
  { id: 1, user: "Виктория М.", avatar: "ВМ", color: "from-rose-800 to-amber-700", lastMsg: "Когда встретимся?", time: "сейчас", unread: 2, online: true },
  { id: 2, user: "Артём К.", avatar: "АК", color: "from-indigo-800 to-purple-700", lastMsg: "Посмотри новый проект", time: "10 мин", unread: 0, online: true },
  { id: 3, user: "Диана С.", avatar: "ДС", color: "from-emerald-800 to-teal-700", lastMsg: "Спасибо за поддержку!", time: "1 ч", unread: 0, online: false },
  { id: 4, user: "Михаил П.", avatar: "МП", color: "from-slate-700 to-zinc-600", lastMsg: "До встречи в пятницу", time: "вчера", unread: 0, online: false },
];

const INITIAL_MESSAGES: Record<number, { id: number; text: string; own: boolean; time: string }[]> = {
  1: [
    { id: 1, text: "Привет! Как прошла поездка?", own: false, time: "10:02" },
    { id: 2, text: "Отлично! Флоренция была потрясающей", own: true, time: "10:05" },
    { id: 3, text: "Завидую! Когда встретимся?", own: false, time: "10:06" },
    { id: 4, text: "Давай на этой неделе, в четверг?", own: true, time: "10:08" },
  ],
  2: [
    { id: 1, text: "Посмотри новый проект, очень интересно", own: false, time: "вчера" },
    { id: 2, text: "Уже смотрю, впечатляет!", own: true, time: "вчера" },
  ],
  3: [
    { id: 1, text: "Спасибо за поддержку!", own: false, time: "1 ч" },
  ],
  4: [
    { id: 1, text: "До встречи в пятницу", own: false, time: "вчера" },
    { id: 2, text: "Буду!", own: true, time: "вчера" },
  ],
};

type Tab = "feed" | "messages" | "notifications" | "profile";

export default function Index({ currentUser, onLogout }: IndexProps) {
  const avatarLetters = (name: string) => {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };
  const CURRENT_USER = {
    id: currentUser.id,
    name: currentUser.name || "Пользователь",
    username: currentUser.username ? `@${currentUser.username}` : currentUser.phone,
    avatar: avatarLetters(currentUser.name || "АА"),
    followers: currentUser.followers_count,
    following: currentUser.following_count,
  };
  const [activeTab, setActiveTab] = useState<Tab>("feed");
  const [posts, setPosts] = useState(INITIAL_POSTS);
  const [notifications, setNotifications] = useState(NOTIFICATIONS);
  const [activeChat, setActiveChat] = useState<number | null>(null);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const [newPostText, setNewPostText] = useState("");
  const [showNewPost, setShowNewPost] = useState(false);

  const unreadNotifs = notifications.filter((n) => !n.read).length;
  const unreadMessages = CHATS.reduce((a, c) => a + c.unread, 0);

  const handleLike = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 }
          : p
      )
    );
  };

  const handleSave = (postId: number) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, saved: !p.saved } : p))
    );
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeChat) return;
    setMessages((prev) => ({
      ...prev,
      [activeChat]: [
        ...(prev[activeChat] || []),
        { id: Date.now(), text: newMessage.trim(), own: true, time: "сейчас" },
      ],
    }));
    setNewMessage("");
  };

  const handlePublishPost = () => {
    if (!newPostText.trim()) return;
    setPosts((prev) => [
      {
        id: Date.now(),
        user: CURRENT_USER.name,
        username: CURRENT_USER.username,
        avatar: CURRENT_USER.avatar,
        avatarColor: "from-amber-600 to-yellow-700",
        time: "только что",
        text: newPostText.trim(),
        likes: 0,
        comments: 0,
        liked: false,
        saved: false,
      },
      ...prev,
    ]);
    setNewPostText("");
    setShowNewPost(false);
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const notifIcon = (type: string) => {
    if (type === "like") return "Heart";
    if (type === "follow") return "UserPlus";
    return "MessageCircle";
  };

  const notifAccent = (type: string) => {
    if (type === "like") return "bg-rose-500";
    if (type === "follow") return "bg-emerald-600";
    return "bg-blue-600";
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Story Viewer */}
      {activeStory !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-scale-in"
          onClick={() => setActiveStory(null)}
        >
          <div
            className="relative w-full max-w-sm mx-4"
            style={{ height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const story = STORIES.find((s) => s.id === activeStory);
              if (!story) return null;
              return (
                <div className={`w-full h-full rounded-3xl bg-gradient-to-br ${story.color} flex flex-col overflow-hidden`}>
                  <div className="p-4 space-y-2">
                    <div className="flex gap-1">
                      {STORIES.map((s) => (
                        <div key={s.id} className="story-timer flex-1">
                          <div
                            className="story-timer-fill"
                            style={{
                              width: s.id < activeStory ? "100%" : s.id === activeStory ? undefined : "0%",
                              animation: s.id === activeStory ? undefined : "none",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-medium">
                        {story.avatar}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">{story.user}</p>
                        <p className="text-white/60 text-xs">5 ч назад · исчезнет через 19 ч</p>
                      </div>
                      <button
                        onClick={() => setActiveStory(null)}
                        className="ml-auto text-white/70 hover:text-white"
                      >
                        <Icon name="X" size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 flex items-center justify-center p-8">
                    <p className="font-display text-3xl text-white/90 text-center leading-relaxed italic">
                      «Каждый момент — это история, достойная быть рассказанной»
                    </p>
                  </div>
                  <div className="p-4 flex items-center gap-3">
                    <input
                      className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2 text-sm outline-none border border-white/20"
                      placeholder="Ответить..."
                    />
                    <button className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                      <Icon name="Send" size={16} />
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Sidebar — desktop */}
      <aside className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-border h-screen sticky top-0 p-5">
        <div className="mb-8">
          <h1 className="font-display text-4xl gold-text tracking-wide">Aura</h1>
          <p className="text-muted-foreground text-xs mt-0.5 font-light tracking-[0.3em] uppercase">social network</p>
        </div>

        <nav className="flex-1 space-y-1">
          {([
            { tab: "feed", icon: "LayoutGrid", label: "Лента" },
            { tab: "messages", icon: "MessageCircle", label: "Сообщения", badge: unreadMessages },
            { tab: "notifications", icon: "Bell", label: "Уведомления", badge: unreadNotifs },
            { tab: "profile", icon: "User", label: "Профиль" },
          ] as { tab: Tab; icon: string; label: string; badge?: number }[]).map(({ tab, icon, label, badge }) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`nav-item w-full ${activeTab === tab ? "active" : ""}`}
            >
              <Icon name={icon} size={18} />
              <span>{label}</span>
              {badge ? (
                <span className="ml-auto text-xs gold-gradient text-background px-2 py-0.5 rounded-full font-medium">
                  {badge}
                </span>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background">
              {CURRENT_USER.avatar}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{CURRENT_USER.name}</p>
              <p className="text-xs text-muted-foreground truncate">{CURRENT_USER.username}</p>
            </div>
            <button
              onClick={onLogout}
              title="Выйти"
              className="ml-auto text-muted-foreground hover:text-rose-400 transition-colors"
            >
              <Icon name="LogOut" size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen pb-16 lg:pb-0">

        {/* ── FEED ── */}
        {activeTab === "feed" && (
          <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 space-y-5">

            {/* Stories row */}
            <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-1">
              <div className="flex-shrink-0 flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-14 h-14 rounded-full bg-secondary border-2 border-dashed border-border group-hover:border-gold/50 flex items-center justify-center transition-all">
                  <Icon name="Plus" size={20} className="text-muted-foreground group-hover:text-gold transition-colors" />
                </div>
                <span className="text-xs text-muted-foreground">Моя история</span>
              </div>

              {STORIES.map((story) => (
                <button
                  key={story.id}
                  onClick={() => setActiveStory(story.id)}
                  className="flex-shrink-0 flex flex-col items-center gap-2"
                >
                  <div className={`p-[2px] rounded-full ${story.seen ? "bg-border" : "gold-gradient"}`}>
                    <div className="w-12 h-12 rounded-full bg-background p-[2px]">
                      <div className={`w-full h-full rounded-full bg-gradient-to-br ${story.color} flex items-center justify-center text-white text-xs font-medium`}>
                        {story.avatar}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground truncate w-14 text-center">
                    {story.user}
                  </span>
                </button>
              ))}
            </div>

            {/* New post composer */}
            <div className="post-card p-4">
              {showNewPost ? (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex gap-3">
                    <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background flex-shrink-0">
                      {CURRENT_USER.avatar}
                    </div>
                    <textarea
                      autoFocus
                      value={newPostText}
                      onChange={(e) => setNewPostText(e.target.value)}
                      placeholder="Поделитесь чем-то особенным..."
                      className="flex-1 bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none resize-none min-h-[80px] font-light leading-relaxed pt-1"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-border">
                    <div className="flex gap-3">
                      <button className="text-muted-foreground hover:text-gold transition-colors">
                        <Icon name="Image" size={18} />
                      </button>
                      <button className="text-muted-foreground hover:text-gold transition-colors">
                        <Icon name="MapPin" size={18} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setShowNewPost(false); setNewPostText(""); }}
                        className="btn-outline-gold"
                      >
                        Отмена
                      </button>
                      <button onClick={handlePublishPost} className="btn-gold">
                        Опубликовать
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewPost(true)}
                  className="flex items-center gap-3 w-full text-left"
                >
                  <div className="w-9 h-9 rounded-full gold-gradient flex items-center justify-center text-sm font-semibold text-background flex-shrink-0">
                    {CURRENT_USER.avatar}
                  </div>
                  <span className="text-muted-foreground text-sm font-light">
                    Что происходит, {CURRENT_USER.name.split(" ")[0]}?
                  </span>
                  <Icon name="PenLine" size={15} className="ml-auto text-muted-foreground/50" />
                </button>
              )}
            </div>

            {/* Posts */}
            {posts.map((post, i) => (
              <div
                key={post.id}
                className={`post-card animate-fade-in`}
                style={{ animationDelay: `${i * 0.06}s`, opacity: 0 }}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${post.avatarColor} flex items-center justify-center text-white text-sm font-medium flex-shrink-0`}>
                      {post.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{post.user}</p>
                      <p className="text-xs text-muted-foreground">{post.time}</p>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name="MoreHorizontal" size={18} />
                    </button>
                  </div>

                  <p className="text-sm font-light leading-relaxed text-foreground/90 mb-5">
                    {post.text}
                  </p>

                  <div className="flex items-center gap-5 pt-3 border-t border-border">
                    <button
                      onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 text-sm transition-all duration-200 ${
                        post.liked ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"
                      }`}
                    >
                      <Icon name="Heart" size={17} />
                      <span>{post.likes}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name="MessageCircle" size={17} />
                      <span>{post.comments}</span>
                    </button>
                    <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Icon name="Share2" size={17} />
                    </button>
                    <button
                      onClick={() => handleSave(post.id)}
                      className={`ml-auto transition-colors duration-200 ${
                        post.saved ? "text-gold" : "text-muted-foreground hover:text-gold"
                      }`}
                    >
                      <Icon name="Bookmark" size={17} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── MESSAGES ── */}
        {activeTab === "messages" && (
          <div className="flex-1 flex" style={{ height: "calc(100vh - 4rem)" }}>
            <div className={`${activeChat ? "hidden md:flex" : "flex"} flex-col w-full md:w-80 border-r border-border`}>
              <div className="p-5 border-b border-border">
                <h2 className="font-display text-2xl mb-3">Сообщения</h2>
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    className="w-full bg-secondary rounded-xl pl-9 pr-4 py-2 text-sm outline-none placeholder-muted-foreground"
                    placeholder="Поиск..."
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {CHATS.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => setActiveChat(chat.id)}
                    className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/50 transition-colors ${
                      activeChat === chat.id ? "bg-secondary/70" : ""
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${chat.color} flex items-center justify-center text-white text-sm font-medium`}>
                        {chat.avatar}
                      </div>
                      {chat.online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-medium truncate">{chat.user}</p>
                        <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">{chat.time}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{chat.lastMsg}</p>
                    </div>
                    {chat.unread > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full gold-gradient flex items-center justify-center text-[10px] font-medium text-background">
                        {chat.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {activeChat ? (
              <div className="flex-1 flex flex-col animate-fade-in">
                {(() => {
                  const chat = CHATS.find((c) => c.id === activeChat);
                  if (!chat) return null;
                  return (
                    <>
                      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                        <button
                          onClick={() => setActiveChat(null)}
                          className="md:hidden text-muted-foreground hover:text-foreground mr-1"
                        >
                          <Icon name="ArrowLeft" size={20} />
                        </button>
                        <div className="relative">
                          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${chat.color} flex items-center justify-center text-white text-sm`}>
                            {chat.avatar}
                          </div>
                          {chat.online && (
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-background" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{chat.user}</p>
                          <p className="text-xs text-muted-foreground">
                            {chat.online ? "в сети" : "не в сети"}
                          </p>
                        </div>
                        <div className="ml-auto flex gap-1">
                          <button className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors">
                            <Icon name="Phone" size={18} />
                          </button>
                          <button className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-secondary transition-colors">
                            <Icon name="Video" size={18} />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {(messages[activeChat] || []).map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.own ? "justify-end" : "justify-start"}`}
                          >
                            <div>
                              <div className={`message-bubble ${msg.own ? "own" : "other"}`}>
                                {msg.text}
                              </div>
                              <p className={`text-xs text-muted-foreground mt-1 ${msg.own ? "text-right" : ""}`}>
                                {msg.time}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 border-t border-border">
                        <div className="flex items-center gap-3 bg-secondary rounded-2xl px-4 py-2.5">
                          <button className="text-muted-foreground hover:text-gold transition-colors">
                            <Icon name="Paperclip" size={17} />
                          </button>
                          <input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            className="flex-1 bg-transparent text-sm outline-none placeholder-muted-foreground"
                            placeholder="Написать сообщение..."
                          />
                          <button
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className="text-muted-foreground hover:text-gold transition-colors disabled:opacity-30"
                          >
                            <Icon name="Send" size={17} />
                          </button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="hidden md:flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full gold-gradient mx-auto mb-4 flex items-center justify-center opacity-30">
                    <Icon name="MessageCircle" size={28} className="text-background" />
                  </div>
                  <p className="font-display text-2xl opacity-40">Выберите диалог</p>
                  <p className="text-sm text-muted-foreground mt-1">чтобы начать общение</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {activeTab === "notifications" && (
          <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-3xl">Уведомления</h2>
              {unreadNotifs > 0 && (
                <button onClick={markAllRead} className="text-xs gold-text hover:opacity-80 transition-opacity">
                  Отметить все как прочитанные
                </button>
              )}
            </div>
            <div className="space-y-2">
              {notifications.map((notif, i) => (
                <div
                  key={notif.id}
                  className={`post-card p-4 flex items-center gap-4 animate-fade-in ${!notif.read ? "border-gold/25" : ""}`}
                  style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${notif.color} flex items-center justify-center text-white text-sm font-medium`}>
                      {notif.avatar}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${notifAccent(notif.type)}`}>
                      <Icon name={notifIcon(notif.type)} size={11} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug">
                      <span className="font-medium">{notif.user}</span>{" "}
                      <span className="text-muted-foreground font-light">{notif.text}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{notif.time}</p>
                  </div>
                  {!notif.read && (
                    <div className="w-2 h-2 rounded-full bg-gold flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROFILE ── */}
        {activeTab === "profile" && (
          <div className="flex-1 max-w-xl w-full mx-auto px-4 py-6 space-y-5 animate-fade-in">
            <div className="post-card p-6">
              <div className="flex items-start gap-5">
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center text-2xl font-semibold text-background">
                    {CURRENT_USER.avatar}
                  </div>
                  <button className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center">
                    <Icon name="Camera" size={12} className="text-muted-foreground" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display text-3xl">{CURRENT_USER.name}</h2>
                  <p className="text-muted-foreground text-sm mt-0.5">{CURRENT_USER.username}</p>
                  <p className="text-sm font-light mt-2 leading-relaxed text-foreground/80">
                    Люблю путешествовать, вдохновляться искусством и делиться моментами, которые стоит помнить.
                  </p>
                  <div className="flex gap-6 mt-4">
                    <div>
                      <p className="font-display text-xl">{posts.filter(p => p.username === CURRENT_USER.username).length + 3}</p>
                      <p className="text-xs text-muted-foreground">публикации</p>
                    </div>
                    <div>
                      <p className="font-display text-xl">{CURRENT_USER.followers.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">подписчики</p>
                    </div>
                    <div>
                      <p className="font-display text-xl">{CURRENT_USER.following}</p>
                      <p className="text-xs text-muted-foreground">подписки</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button className="btn-gold flex-1 text-center">Редактировать профиль</button>
                <button className="btn-outline-gold px-3">
                  <Icon name="Share2" size={16} />
                </button>
                <button
                  onClick={onLogout}
                  title="Выйти"
                  className="btn-outline-gold px-3 hover:border-rose-500/50 hover:text-rose-400"
                >
                  <Icon name="LogOut" size={16} />
                </button>
              </div>
            </div>

            <div className="post-card p-5">
              <h3 className="font-display text-xl mb-4">Мои публикации</h3>
              <div className="space-y-3">
                {posts
                  .filter((p) => p.username === CURRENT_USER.username)
                  .map((post) => (
                    <div key={post.id} className="p-3 bg-secondary rounded-xl">
                      <p className="text-sm font-light leading-relaxed">{post.text}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Icon name="Heart" size={11} /> {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="MessageCircle" size={11} /> {post.comments}
                        </span>
                        <span className="ml-auto">{post.time}</span>
                      </div>
                    </div>
                  ))}
                {posts.filter((p) => p.username === CURRENT_USER.username).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Пока нет публикаций.<br />
                    <span className="text-xs">Поделитесь первым моментом в ленте.</span>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom nav — mobile */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur-sm flex z-40">
        {([
          { tab: "feed", icon: "LayoutGrid", label: "Лента" },
          { tab: "messages", icon: "MessageCircle", label: "Чат", badge: unreadMessages },
          { tab: "notifications", icon: "Bell", label: "", badge: unreadNotifs },
          { tab: "profile", icon: "User", label: "Профиль" },
        ] as { tab: Tab; icon: string; label: string; badge?: number }[]).map(({ tab, icon, label, badge }) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors relative ${
              activeTab === tab ? "text-gold" : "text-muted-foreground"
            }`}
          >
            <div className="relative">
              <Icon name={icon} size={22} />
              {badge ? (
                <span className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full gold-gradient flex items-center justify-center text-[10px] font-medium text-background">
                  {badge}
                </span>
              ) : null}
            </div>
            {label && <span>{label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}