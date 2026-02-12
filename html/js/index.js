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

let selectedUserId = null

/* ======================
   加载花名册
====================== */
async function loadMembers() {
  const { data, error } = await client
    .from("baiye_members")
    .select("user_id, nickname, avatar_url")
    .order("created_at")

  if (error) {
    console.error(error)
    return
  }

  memberGrid.innerHTML = ""
  const current = localStorage.getItem("currentUser")

  data.forEach(m => {
    const div = document.createElement("div")
    div.className = "member-card"
    if (m.user_id === current) div.classList.add("me")
      
  const avatarSrc = m.avatar_url || "img/default-avatar.png"


    div.innerHTML = `
      <div class="avatar">
        <img src="${avatarSrc}" alt="avatar">
      </div>
      <div class="name">${m.nickname || m.user_id}</div>
    `




    div.onclick = () => {
      selectMember(m.user_id, m.nickname)
      if (m.user_id === current) {
        avatarInput.click()
      }
    }

    memberGrid.appendChild(div)
  })

  const add = document.createElement("div")
  add.className = "member-card add-card"
  add.innerText = "＋"
  add.onclick = openRegister
  memberGrid.appendChild(add)
}

/* ======================
   选择成员 / 登录
====================== */
function selectMember(userId, nickname) {
  selectedUserId = userId
  document.getElementById("loginArea").style.display = "block"
  document.getElementById("selectedName").innerText =
    `当前选择：${nickname || userId}`
  document.getElementById("loginPin").value = ""
  document.getElementById("loginMsg").innerText = ""
}

async function verifyPin() {
  const pin = document.getElementById("loginPin").value.trim()
  const loginMsg = document.getElementById("loginMsg")

  if (!/^\d{4}$/.test(pin)) {
    loginMsg.innerText = "请输入 4 位数字密码"
    return
  }

  const { data, error } = await client
    .from("baiye_members")
    .select("user_id, nickname")
    .eq("user_id", selectedUserId)
    .eq("password", pin)
    .single()

  if (error || !data) {
    loginMsg.innerText = "密码错误"
    return
  }

  localStorage.setItem("currentUser", selectedUserId)
  loginMsg.innerText = "登录成功"
  loadMembers()
}

/* ======================
   注册
====================== */
async function registerMember() {
  const userId = document.getElementById("userId").value.trim()
  const pin = document.getElementById("pin").value.trim()
  const nickname = document.getElementById("nickname").value.trim()

  if (!userId || !/^\d{4}$/.test(pin)) {
    msg.innerText = "ID 不能为空，PIN 必须 4 位数字"
    return
  }

  const { data: exist } = await client
    .from("baiye_members")
    .select("id")
    .eq("user_id", userId)

  if (exist.length > 0) {
    msg.innerText = "这个 ID 已被注册"
    return
  }

  await client.from("baiye_members").insert({
    user_id: userId,
    password: parseInt(pin),
    nickname: nickname || null
  })


  closeRegister()
  loadMembers()
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

  const userId = localStorage.getItem("currentUser")

  if (!userId) {
    alert("未登录")
    return
  }

  const ext = file.name.split(".").pop()
  const filePath = `avatar_${Date.now()}.${ext}`


  // 上传（用 upsert 替换旧头像）
  const { error: uploadError } = await client.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true })

  if (uploadError) {
    alert(uploadError.message)
    return
  }

  const { data } = client.storage
    .from("avatars")
    .getPublicUrl(filePath)

  // 写数据库
  const { error: updateError } = await client
    .from("baiye_members")
    .update({ avatar_url: data.publicUrl })
    .eq("user_id", userId)

  if (updateError) {
    alert(updateError.message)
    return
  }

  avatarInput.value = ""
  loadMembers()
}


/* ======================
   初始化
====================== */
document.addEventListener("DOMContentLoaded", loadMembers)
