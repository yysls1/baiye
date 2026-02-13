/* ======================
   Supabase 初始化
====================== */
const client = window.supabase.createClient(
  "https://sdkrumvzefqgcrnomesm.supabase.co",
  "sb_publishable_dGKp0d2Se_-jJz1JReK24A_Qfv4S5yE"
)

/* ======================
   DOM
====================== */
const memberGrid = document.getElementById("memberGrid")
const msg = document.getElementById("msg")
const avatarInput = document.getElementById("avatarInput")
const commentList = document.getElementById("commentList")
const commentInput = document.getElementById("commentInput")

/* ======================
   花名册加载
====================== */
async function loadMembers() {
  const { data: { user } } = await client.auth.getUser()

  const { data, error } = await client
    .from("baiye_members")
    .select("id, username, nickname, avatar_url, role, priority")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("加载失败:", error.message)
    return
  }

  const sortedMembers = sortMembersByPriority(data) // 按 priority 排序

  memberGrid.innerHTML = ""

  sortedMembers.forEach(m => {
    const div = document.createElement("div")
    div.className = "member-card"

    const avatarSrc = m.avatar_url || "./img/default-avatar.png"

    if (user && m.id === user.id) {
      div.classList.add("me")
      div.onclick = () => avatarInput.click()
    } else {
      div.onclick = () => openLoginModal(m.id)
    }

    div.innerHTML = `
      <div class="avatar">
        <img src="${avatarSrc}" alt="">
      </div>
      <div class="id">${m.username}</div>
      ${m.nickname && m.nickname !== m.username ? `<div class="nickname">${m.nickname}</div>` : ""}
      ${m.role ? `<div class="role">【${m.role}】</div>` : ""}
    `

    memberGrid.appendChild(div)
  })

  const add = document.createElement("div")
  add.className = "member-card add-card"
  add.innerText = "＋"
  add.onclick = openRegister
  memberGrid.appendChild(add)
}

// 按 priority 排序，priority 小的排前
function sortMembersByPriority(members) {
  return members.sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
}

// 获取显示名
function getDisplayName(member) {
  if (member.nickname && member.nickname !== member.username) {
    return `${member.username}（${member.nickname}）`
  } else {
    return member.username
  }
}

function getDisplayNameWithRole(member) {
  let displayName = member.username;
  if (member.nickname && member.nickname !== member.username) {
    displayName += `<br><span class="nickname">${member.nickname}</span>`;
  }
  if (member.role) {
    displayName += `<br><span class="role">【${member.role}】</span>`;
  }
  return displayName;
}

/* ======================
   注册
====================== */
async function registerMember() {
  const username = document.getElementById("userId").value.trim()
  const password = document.getElementById("pin").value.trim()
  const nickname = document.getElementById("nickname").value.trim()

  if (!username || password.length < 6) {
    msg.innerText = "密码至少6位"
    return
  }

  // ✅ 先检查重复用户名
  const { data: existingUser } = await client
    .from("baiye_members")
    .select("id")
    .eq("username", username)
    .maybeSingle()

  if (existingUser) {
    msg.innerText = "该用户名已被注册"
    return
  }

  const fakeEmail = `${crypto.randomUUID()}@jianzu.com`

  const { data, error } = await client.auth.signUp({
    email: fakeEmail,
    password
  })

  if (error) {
    msg.innerText = error.message
    return
  }

  await client.from("baiye_members").insert({
    id: data.user.id,
    nickname: nickname || username,
    username: username,
    email: fakeEmail,
    priority: 999
  })

  msg.innerText = "注册成功"
  closeRegister()
  await loadMembers()
}

/* ======================
   注册弹层
====================== */
function openRegister() {
  document.getElementById("registerPanel").style.display = "flex"
}

function closeRegister() {
  document.getElementById("registerPanel").style.display = "none"
  msg.innerText = ""
}

/* ======================
   头像上传
====================== */
avatarInput.onchange = async () => {
  const file = avatarInput.files[0]
  if (!file) return

  const { data: { user } } = await client.auth.getUser()
  if (!user) {
    alert("未登录")
    return
  }

  const ext = file.name.split(".").pop()
  const filePath = `${user.id}/avatar_${Date.now()}.${ext}`

  const { error: uploadError } = await client.storage
    .from("avatars")
    .upload(filePath, file)

  if (uploadError) return alert(uploadError.message)

  const { data } = client.storage
    .from("avatars")
    .getPublicUrl(filePath)

  await client
    .from("baiye_members")
    .update({ avatar_url: data.publicUrl + "?t=" + Date.now() })
    .eq("id", user.id)

  loadMembers()
}

/* ======================
   登录弹窗
====================== */
let selectedLoginId = null

function openLoginModal(userId) {
  selectedLoginId = userId
  document.getElementById("loginModal").style.display = "flex"
}

function closeLogin() {
  document.getElementById("loginModal").style.display = "none"
  document.getElementById("loginPassword").value = ""
}

async function confirmLogin() {
  const password = document.getElementById("loginPassword").value.trim()
  if (!password) return

  const { data, error: fetchError } = await client
    .from("baiye_members")
    .select("email")
    .eq("id", selectedLoginId)
    .single()

  if (fetchError || !data) {
    alert("用户不存在")
    return
  }

  const { error } = await client.auth.signInWithPassword({
    email: data.email,
    password
  })

  if (error) {
    alert("密码错误")
    return
  }

  document.getElementById("loginModal").style.display = "none"
  loadMembers()
}

/* ======================
   留言板
====================== */
async function loadComments() {
  const { data: comments, error } = await client
    .from("baiye_comments")
    .select("id, user_id, nickname, content, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("加载留言失败:", error.message)
    return
  }

  commentList.innerHTML = ""

  for (const c of comments) {
    // 获取成员信息
    let avatarUrl = "img/default-avatar.png"
    let role = ""
    let username = c.nickname || "未命名"

    const { data: memberData } = await client
      .from("baiye_members")
      .select("avatar_url, role, username")
      .eq("id", c.user_id)
      .single()

    if (memberData) {
      if (memberData.avatar_url) avatarUrl = memberData.avatar_url
      if (memberData.role) role = memberData.role
      username = memberData.username || username
    }

    // 构建显示内容
    const displayName = c.nickname && c.nickname !== username
      ? `${username}（${c.nickname}）`
      : username

    const div = document.createElement("div")
    div.className = "comment-card"
    div.innerHTML = `
      <div class="avatar">
        <img src="${avatarUrl}" alt="avatar">
      </div>
      <div class="comment-content">
        <div class="nickname-row">
          <span class="nickname">${displayName}</span>
          ${role ? `<span class="role">【${role}】</span>` : ""}
        </div>
        <div class="content">${c.content}</div>
        <div class="time">${new Date(c.created_at).toLocaleString()}</div>
      </div>
    `
    commentList.appendChild(div)
  }

  commentList.scrollTop = 0
}

commentInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault()
    sendComment()
  }
})

async function sendComment() {
  const content = commentInput.value.trim()
  if (!content) return alert("请输入留言内容")

  const { data: { user } } = await client.auth.getUser()
  if (!user) return alert("请先登录才能留言")

  const nickname = await getMyNickname() || "未命名"

  const { data, error } = await client
    .from("baiye_comments")
    .insert({
      user_id: user.id,
      nickname,
      content
    })
    .select()
    .single()

  if (error) return alert("留言失败: " + error.message)

  commentInput.value = ""

  const div = document.createElement("div")
  div.className = "comment-card"
  div.innerHTML = `
    <div class="avatar">
      <img src="${await getMyAvatar()}" alt="avatar">
    </div>
    <div class="comment-content">
      <div class="nickname">${nickname}</div>
      <div class="content">${content}</div>
      <div class="time">${new Date().toLocaleString()}</div>
    </div>
  `
  commentList.prepend(div)
}

async function getMyAvatar() {
  const { data } = await client
    .from("baiye_members")
    .select("avatar_url")
    .eq("id", (await client.auth.getUser()).data.user.id)
    .single()
  return (data && data.avatar_url) || "img/default-avatar.png"
}

async function getMyNickname() {
  const { data, error } = await client
    .from("baiye_members")
    .select("nickname")
    .eq("id", (await client.auth.getUser()).data.user.id)
    .single()
  if (error) return null
  return data.nickname
}

/* ======================
   初始化
====================== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadMembers()
  await loadComments()

  client.auth.onAuthStateChange(() => {
    loadMembers()
  })
})
