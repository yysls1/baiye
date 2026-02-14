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

  if (!memberGrid || !commentList || !commentInput || !avatarInput || !msg || !sendBtn) return;

  
  /* ======================
     花名册加载
  ===================== */
  async function loadMembers() {
    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      const { data, error } = await window.supabaseClient
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
      const { data: existingUser } = await window.supabaseClient
        .from("baiye_members")
        .select("id")
        .eq("username", username)
        .maybeSingle();

      if (existingUser) {
        msg.innerText = "该用户名已被注册";
        return;
      }

      const fakeEmail = `${crypto.randomUUID()}@jianzu.com`;
      const { data, error } = await window.supabaseClient.auth.signUp({ email: fakeEmail, password });
      if (error) return void (msg.innerText = error.message);

      await window.supabaseClient.from("baiye_members").insert({
        id: data.user.id,
        nickname: nickname || username,
        username,
        email: fakeEmail,
        priority: 999
      });

      msg.innerText = "注册成功";
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
    const { data: { user } } = await window.supabaseClient.auth.getUser();
    if (!user) return alert("未登录");

    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar_${Date.now()}.${ext}`;

      const { error: uploadError } = await window.supabaseClient.storage.from("avatars").upload(filePath, file);
      if (uploadError) return alert(uploadError.message);

      const { data } = window.supabaseClient.storage.from("avatars").getPublicUrl(filePath);
      await window.supabaseClient.from("baiye_members").update({ avatar_url: data.publicUrl + "?t=" + Date.now() }).eq("id", user.id);

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
      const { data, error: fetchError } = await window.supabaseClient.from("baiye_members").select("email").eq("id", selectedLoginId).maybeSingle();
      if (fetchError || !data) return alert("用户不存在");

      const { error } = await window.supabaseClient.auth.signInWithPassword({ email: data.email, password });
      if (error) return alert("密码错误");

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
    try {
      const { data: comments, error } = await window.supabaseClient
        .from("baiye_comments")
        .select("id, user_id, nickname, content, created_at")
        .order("created_at", { ascending: false });

      if (error) return console.error("加载留言失败:", error.message);
      commentList.innerHTML = "";
      if (!comments || comments.length === 0) return;

      const userIds = [...new Set(comments.map(c => c.user_id))];
      const { data: members } = await window.supabaseClient
        .from("baiye_members")
        .select("id, avatar_url, role, username")
        .in("id", userIds);

      const memberMap = new Map();
      (members || []).forEach(m => memberMap.set(m.id, m));

      comments.forEach(c => {
        const m = memberMap.get(c.user_id) || {};
        const avatarUrl = m.avatar_url || "img/default-avatar.png";
        const role = m.role || "";
        const username = m.username || c.nickname || "未命名";
        const displayName = c.nickname && c.nickname !== username ? `${username}（${c.nickname}）` : username;

        const div = document.createElement("div");
        div.className = "comment-card";
        div.innerHTML = `
          <div class="avatar"><img src="${avatarUrl}" alt="avatar"></div>
          <div class="comment-content">
            <div class="nickname-row">
              <span class="nickname">${displayName}</span>
              ${role ? `<span class="role">【${role}】</span>` : ""}
            </div>
            <div class="content">${c.content}</div>
            <div class="time">${new Date(c.created_at).toLocaleString()}</div>
          </div>
        `;
        commentList.appendChild(div);
      });
      commentList.scrollTop = 0;
    } catch (err) {
      console.error("加载留言异常:", err);
    }
  }

  async function sendComment() {
    const content = commentInput.value.trim();
    if (!content) return alert("请输入留言内容");

    try {
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return alert("请先登录才能留言");

      const nickname = await getMyNickname() || "未命名";

      const { error } = await window.supabaseClient.from("baiye_comments").insert({
        user_id: user.id,
        nickname,
        content
      });
      if (error) return alert("留言失败: " + error.message);

      commentInput.value = "";
      await loadComments(); // 更新留言列表
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
      const { data: { user } } = await window.supabaseClient.auth.getUser();
      if (!user) return null;

      const { data } = await window.supabaseClient.from("baiye_members")
        .select("nickname")
        .eq("id", user.id)
        .maybeSingle();
      return data?.nickname || null;
    } catch {
      return null;
    }
  }

// 留言板发送
sendBtn.addEventListener("click", sendComment);
commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendComment();
  }
});

// 注册按钮
const registerBtn = document.getElementById("registerBtn");
registerBtn.addEventListener("click", registerMember);


  /* ======================
     初始化
  ===================== */
  await loadMembers();
  await loadComments();
  window.supabaseClient.auth.onAuthStateChange(() => loadMembers());

  window.registerMember = registerMember;
  window.openRegister = openRegister;
  window.closeRegister = closeRegister;
  window.openLoginModal = openLoginModal;
  window.closeLogin = closeLogin;
  window.confirmLogin = confirmLogin;
  window.sendComment = sendComment;

  console.log("Home 页面初始化完成 ✅");
}
