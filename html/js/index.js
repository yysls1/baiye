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


/* ======================
   加载花名册
====================== */
async function loadMembers() {
  const { data: { user } } = await client.auth.getUser()

  const { data, error } = await client
    .from("baiye_members")
    .select("id, nickname, avatar_url")
    .order("created_at", { ascending: true })

  if (error) {
    console.error("加载失败:", error.message)
    return
  }

  memberGrid.innerHTML = ""

  data.forEach(m => {
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
      <div class="name">${m.nickname || "未命名"}</div>
    `

    memberGrid.appendChild(div)
  })

  const add = document.createElement("div")
  add.className = "member-card add-card"
  add.innerText = "＋"
  add.onclick = openRegister
  memberGrid.appendChild(add)
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

  // ✅ 生成随机邮箱
  const fakeEmail = `${crypto.randomUUID()}@jianzu.com`

  const { data, error } = await client.auth.signUp({
    email: fakeEmail,
    password
  })

  if (error) {
    msg.innerText = error.message
    return
  }

  if (!data.user) {
    msg.innerText = "注册失败"
    return
  }

  // ✅ 保存 email 到自己的表
  const { error: insertError } = await client
    .from("baiye_members")
    .insert({
      id: data.user.id,
      nickname: nickname || username,
      email: fakeEmail
    })

  if (insertError) {
    msg.innerText = insertError.message
    return
  }

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
   头像上传（核心）
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

  // 先查出该用户的 email
  const { data, error: fetchError } = await client
    .from("baiye_members")
    .select("email")
    .eq("id", selectedLoginId)
    .single()

  if (fetchError || !data) {
    alert("用户不存在")
    return
  }

  // 用数据库里保存的 email 登录
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

/* 
Comment
*/

const commentList = document.getElementById("commentList")
const commentInput = document.getElementById("commentInput")

// 加载留言
async function loadComments() {
  const { data: comments, error } = await client
    .from("baiye_comments")
    .select("id, user_id, nickname, content, created_at")
    .order("created_at", { ascending: false }) // 最新在前

  if (error) {
    console.error("加载留言失败:", error.message)
    return
  }

  commentList.innerHTML = ""

  comments.forEach(c => {
    const div = document.createElement("div")
    div.className = "comment-card"
    div.innerHTML = `
      <div class="nickname">${c.nickname}</div>
      <div class="content">${c.content}</div>
    `
    commentList.appendChild(div)
  })
}

// 发送留言
async function sendComment() {
  const content = commentInput.value.trim()
  if (!content) return alert("请输入留言内容")

  const { data: { user } } = await client.auth.getUser()
  if (!user) return alert("请先登录才能留言")

  const { error } = await client
    .from("baiye_comments")
    .insert({
      user_id: user.id,
      nickname: (await getMyNickname()) || "未命名",
      content
    })

  if (error) return alert("留言失败: " + error.message)

  commentInput.value = ""
  loadComments()
}

// 获取自己昵称
async function getMyNickname() {
  const { data, error } = await client
    .from("baiye_members")
    .select("nickname")
    .eq("id", (await client.auth.getUser()).data.user.id)
    .single()

  if (error) return null
  return data.nickname
}

// 页面加载时初始化留言
document.addEventListener("DOMContentLoaded", async () => {
  await loadComments()
})


/* ======================
   初始化
====================== */
document.addEventListener("DOMContentLoaded", async () => {

  // 页面初始加载
  await loadMembers()

  // 监听登录 / 登出状态变化
  client.auth.onAuthStateChange((event, session) => {
    loadMembers()
  })

})
