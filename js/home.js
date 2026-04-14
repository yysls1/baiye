import supabase from "./supabase.js";
/* ======================
   Home 页面逻辑
====================== */
export async function initHome() {
  console.log("初始化 Home 页面");

  const memberGrid = document.getElementById("memberGrid");
  const commentList = document.getElementById("commentList");
  const commentInput = document.getElementById("commentInput");
  const avatarInput = document.getElementById("avatarInput");
  const msg = document.getElementById("msg");
  const sendBtn = document.getElementById("commentSendBtn");
  const memberCache = new Map();
  const renderedIds = new Set();
  if (!memberGrid || !commentList || !commentInput || !avatarInput || !msg || !sendBtn) return;

  
  /* ======================
     花名册加载
  ===================== */
  async function loadMembers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("baiye_members")
        .select("id, username, nickname, avatar_url, role, priority")
        .order("created_at", { ascending: true });

      if (error) return console.error("加载失败:", error.message);

      const sortedMembers = (data || []).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
      memberGrid.innerHTML = "";

      sortedMembers.forEach(m => {
        const div = document.createElement("div");
        div.className = "member-card";
        const avatarSrc = m.avatar_url || "./img/default-avatar.png";

        if (user && m.id === user.id) {
          div.classList.add("me");
          div.onclick = () => avatarInput.click();
        } else {
          div.onclick = () => openLoginModal(m.id);
        }

        div.innerHTML = `
          <div class="avatar"><img src="${avatarSrc}" alt=""></div>
          <div class="id">${m.username}</div>
          ${m.nickname && m.nickname !== m.username ? `<div class="nickname">${m.nickname}</div>` : ""}
          ${m.role ? `<div class="role">【${m.role}】</div>` : ""}
        `;
        memberGrid.appendChild(div);
      });

      // 添加 + 号注册按钮
      const add = document.createElement("div");
      add.className = "member-card add-card";
      add.innerText = "＋";
      add.onclick = openRegister;
      memberGrid.appendChild(add);
    } catch (err) {
      console.error("加载花名册异常:", err);
    }
  }

  /* ======================
     注册
  ===================== */
  async function registerMember() {
    const username = document.getElementById("userId").value.trim();
    const password = document.getElementById("pin").value.trim();
    const nickname = document.getElementById("nickname").value.trim();

    if (!username || password.length < 6) {
      msg.innerText = "密码至少6位";
      return;
    }

    try {
      const { data: existingUser } = await supabase
        .from("baiye_members")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        msg.innerText = "同ID只能注册一次！比比拉布";
        return;
      }

      const fakeEmail = `${crypto.randomUUID()}@jianzu.com`;
      const { data, error } = await supabase.auth.signUp({ email: fakeEmail, password });
      if (error) return void (msg.innerText = error.message);

      await supabase.from("baiye_members").insert({
        id: data.user.id,
        nickname: nickname || username,
        username,
        email: fakeEmail,
        priority: 999
      });

      msg.innerText = "注册成功！蒸棒！";
      closeRegister();
      await loadMembers();
    } catch (err) {
      console.error("注册异常:", err);
      msg.innerText = "注册失败，请重试";
    }
  }

  function openRegister() { document.getElementById("registerPanel").style.display = "flex"; }
  function closeRegister() { document.getElementById("registerPanel").style.display = "none"; msg.innerText = ""; }

  /* ======================
     头像上传
  ===================== */
  avatarInput.onchange = async () => {
    const file = avatarInput.files[0];
    if (!file) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert("未登录");

    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file);
      if (uploadError) return alert(uploadError.message);

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      await supabase.from("baiye_members").update({ avatar_url: data.publicUrl + "?t=" + Date.now() }).eq("id", user.id);

      await loadMembers();
    } catch (err) {
      console.error("上传头像失败:", err);
      alert("头像上传失败");
    }
  };

  /* ======================
     登录弹窗
  ===================== */
  let selectedLoginId = null;
  function openLoginModal(userId) { selectedLoginId = userId; document.getElementById("loginModal").style.display = "flex"; }
  function closeLogin() { document.getElementById("loginModal").style.display = "none"; document.getElementById("loginPassword").value = ""; }

  async function confirmLogin() {
    const password = document.getElementById("loginPassword").value.trim();
    if (!password) return;

    try {
      const { data, error: fetchError } = await supabase.from("baiye_members").select("email").eq("id", selectedLoginId).maybeSingle();
      if (fetchError || !data) return alert("用户不存在");

      const { error } = await supabase.auth.signInWithPassword({ email: data.email, password });
      if (error) return alert("密码...不记得了吗？！（真忘记了找社主)");

      document.getElementById("loginModal").style.display = "none";
      await loadMembers();
    } catch (err) {
      console.error("登录异常:", err);
      alert("登录失败，请重试");
    }
  }

  /* ======================
     留言板
  ===================== */
  async function loadComments() {
  const oldHTML = commentList.innerHTML;

  try {
    const { data: comments, error } = await supabase
      .from("baiye_comments")
      .select("id, user_id, nickname, content, created_at")
      .order("created_at", { ascending: false })
      .limit(50); // ⭐ 限制数量（关键）

    if (error) throw error;

    if (!comments || comments.length === 0) {
      commentList.innerHTML = "";
      renderedIds.clear();
      return;
    }

    let html = "";

    const userIds = [...new Set(comments.map(c => c.user_id))];

    const { data: members } = await supabase
      .from("baiye_members")
      .select("id, avatar_url, role, username")
      .in("id", userIds);

    const memberMap = new Map();

    (members || []).forEach(m => {
      memberMap.set(m.id, m);
      memberCache.set(m.id, m); // ⭐ 缓存起来（关键）
    });

    renderedIds.clear();

    comments.forEach(c => {
      renderedIds.add(c.id);

      const m = memberMap.get(c.user_id) || {};

      const avatarUrl = m.avatar_url || "img/default-avatar.png";
      const role = m.role || "";
      const username = m.username || c.nickname || "未命名";

      const displayName =
        c.nickname && c.nickname !== username
          ? `${username}（${c.nickname}）`
          : username;

      html += `
        <div class="comment-card">
          <div class="avatar"><img src="${avatarUrl}"></div>
          <div class="comment-content">
            <div class="nickname-row">
              <span class="nickname">${displayName}</span>
              ${role ? `<span class="role">【${role}】</span>` : ""}
            </div>
            <div class="content">${c.content}</div>
            <div class="time">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        </div>
      `;
    });

    commentList.innerHTML = html;

  } catch (err) {
    console.error("加载留言异常:", err);
    commentList.innerHTML = oldHTML;
  }
  }

  async function sendComment() {
    const content = commentInput.value.trim();
    if (!content) return alert("请输入留言内容");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return alert("你都没登陆...留个damn");

      const nickname = await getMyNickname() || "未命名";

      const { error } = await supabase.from("baiye_comments").insert({
        user_id: user.id,
        nickname,
        content
      });

      // 🔥自己先加一条（关键）
      addCommentToPage({
        id: "temp_" + Date.now(), // ⭐ 临时 id
        user_id: user.id,
        nickname,
        content,
        created_at: new Date().toISOString(),
        isTemp:true
      });
      if (error) return alert("留言失败: " + error.message);

      commentInput.value = "";
    } catch (err) {
      console.error("发送留言异常:", err);
      alert("发送留言失败");
    }
  }

  sendBtn.addEventListener("click", sendComment);
  commentInput.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sendComment(); } });

  /* ======================
     获取用户昵称
  ===================== */
  async function getMyNickname() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase.from("baiye_members")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();
      return data?.nickname || null;
    } catch {
      return null;
    }
  }


// 注册按钮
const registerBtn = document.getElementById("registerBtn");
registerBtn.addEventListener("click", registerMember);



  //pop音效
  const audio = new Audio("music/pop.mp3");

  function playSound() {
    audio.currentTime = 0; // 防止连续触发没声音
    audio.play();
  }

    async function addCommentToPage(c) {

    if (!c.isTemp && renderedIds.has(c.id)) return;
    renderedIds.add(c.id);

    // ❌ 原来：await getMember()
    // ✅ 现在：直接用缓存
    const member = memberCache.get(c.user_id) || {};

    const avatarUrl =
      (member.avatar_url ? member.avatar_url + "?t=" + Date.now() : null)
      || "img/default-avatar.png";

    const role = member.role || "";
    const username = member.username || c.nickname || "未命名";

    const displayName =
      c.nickname && c.nickname !== username
        ? `${username}（${c.nickname}）`
        : username;

    const div = document.createElement("div");
    div.className = "comment-card";

    div.innerHTML = `
      <div class="avatar"><img src="${avatarUrl}"></div>
      <div class="comment-content">
        <div class="nickname-row">
          <span class="nickname">${displayName}</span>
          ${role ? `<span class="role">【${role}】</span>` : ""}
        </div>
        <div class="content">${c.content}</div>
        <div class="time">刚刚</div>
      </div>
    `;

    commentList.prepend(div);
    }

      function showToast(message) {
        const toast = document.createElement("div");
        toast.innerText = message;

        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.background = "rgba(0,0,0,0.8)";
        toast.style.color = "#fff";
        toast.style.padding = "10px 20px";
        toast.style.borderRadius = "10px";
        toast.style.zIndex = "9999";
        toast.style.opacity = "0";
        toast.style.transition = "0.3s";

        document.body.appendChild(toast);

        // 淡入
        setTimeout(() => {
          toast.style.opacity = "1";
        }, 10);

        // 淡出
        setTimeout(() => {
          toast.style.opacity = "0";
          setTimeout(() => toast.remove(), 300);
        }, 2500);
      }

    let realtimeChannel = null;
    let reconnecting = false;
    function setupRealtime() {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

  realtimeChannel = supabase.channel('baiye_comments_channel');

  realtimeChannel
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'baiye_comments',
      },
      async (payload) => {
        const newComment = payload.new;

        const { data: { user } } = await supabase.auth.getUser();

        // ❌ 原来：await loadComments()
        // ✅ 现在：直接跳过（因为已经本地加了）
        if (user && newComment.user_id === user.id) {
          return;
        }

        showToast("💬 有新留言！");
        playSound();

        addCommentToPage(newComment);
      }
    )
    .subscribe(async (status) => {
      console.log("订阅状态:", status);

      if (status === "SUBSCRIBED") {
        console.log("✅ Realtime连接成功");
      }

      if (
        (status === "CHANNEL_ERROR" || status === "TIMED_OUT") &&
        !reconnecting
      ) {
        reconnecting = true;

        console.warn("⚠️ Realtime断了，重连中...");

        setTimeout(() => {
          setupRealtime();
          reconnecting = false;
        }, 2000);
      }
    });
  }


  async function getMember(userId) {
    if (memberCache.has(userId)) {
      return memberCache.get(userId);
    }

    const { data } = await supabase
      .from("baiye_members")
      .select("avatar_url, role, username")
      .eq("id", userId)
      .maybeSingle();

    memberCache.set(userId, data);
    return data;
  }


  /* ======================
     初始化
  ===================== */
  await loadMembers();
  await loadComments();
  supabase.auth.onAuthStateChange(() => loadMembers());

  setupRealtime();
  window.registerMember = registerMember;
  window.openRegister = openRegister;
  window.closeRegister = closeRegister;
  window.openLoginModal = openLoginModal;
  window.closeLogin = closeLogin;
  window.confirmLogin = confirmLogin;
  window.sendComment = sendComment;

  console.log("Home 页面初始化完成 ✅");

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible") {
      console.log("👀 回来 → 重建一切");

      try {
        // 1️⃣ 彻底断掉旧连接
        if (realtimeChannel) {
          supabase.removeChannel(realtimeChannel);
          realtimeChannel = null;
        }

        // 2️⃣ 清缓存（避免脏数据）
        memberCache.clear();

        // 3️⃣ 重新连接 realtime
        setupRealtime();

        // 4️⃣ 拉完整数据（最终状态）
        await loadComments();

      } catch (e) {
        console.error("恢复失败:", e);
      }
    }
  });
}