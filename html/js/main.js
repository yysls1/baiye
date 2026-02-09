// ======================
// 页面加载
// ======================
async function load() {
  const { data, error } = await client
    .from("slots")
    .select("*")
    .order("slot_number");

  if (error) {
    alert(error.message);
    return;
  }

  const groups = {};
  data.forEach(s => {
    if (!groups[s.group_type]) groups[s.group_type] = [];
    groups[s.group_type].push(s);
  });

  const grid = document.getElementById("grid");
  grid.innerHTML = "";

  ["大团", "打野&守家"].forEach(type => {
    if (!groups[type]) return;

    const groupDiv = document.createElement("div");
    groupDiv.className = "group";

    const title = document.createElement("h3");
    title.innerText = `【${type}】`;
    groupDiv.appendChild(title);

    const section = document.createElement("div");
    section.className = "grid";

    groups[type].forEach(s => {
      const div = document.createElement("div");
      div.className = "slot" + (s.taken ? " taken" : "");

      if ([1,2,3,16,17,21,22].includes(s.slot_number)) div.classList.add("yellow");
      else if ([4,5,10,15,20,25,30].includes(s.slot_number)) div.classList.add("green");
      else if ([26,27,28,29].includes(s.slot_number)) div.classList.add("red");
      else div.classList.add("blue");

      div.innerText = s.taken
        ? `${s.slot_number}\n${s.name}`
        : s.slot_number;

      if (!s.taken) div.onclick = () => take(s.slot_number);

      section.appendChild(div);
    });

    groupDiv.appendChild(section);
    grid.appendChild(groupDiv);
  });
}

// ======================
// 抢号
// ======================
async function take(num) {
  const name = prompt("请输入昵称 / 游戏ID");
  if (!name) return;

  const { data, error } = await client
    .from("slots")
    .update({ taken: true, name })
    .eq("slot_number", num)
    .eq("taken", false)
    .select();

  if (error) {
    alert("抢号失败：" + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert("手慢无！");
    load();
    return;
  }

  document.body.classList.add("flash");
  setTimeout(() => document.body.classList.remove("flash"), 300);

  alert(`！！蒸蚌！！\n昵称：${name}\n位置：${num}`);
  load();
}

// ======================
// 取消报名
// ======================
async function cancelSign() {
  const name = prompt("输入昵称 / 游戏ID");
  if (!name) return;

  const { data } = await client
    .from("slots")
    .select("*")
    .eq("name", name)
    .eq("taken", true);

  if (!data || data.length === 0) {
    alert("你乱打的吧！");
    return;
  }

  await client
    .from("slots")
    .update({ taken: false, name: null })
    .eq("name", name);

  alert("已成功取消报名！");
  load();
}

load();

// ======================
// BGM + Start Gate（唯一入口）
// ======================
document.addEventListener("DOMContentLoaded", () => {
  const bgm = document.getElementById("bgm");
  const gate = document.getElementById("startGate");
  const startBtn = document.getElementById("startBtn");
  const toggleBtn = document.getElementById("bgmToggle");

  if (!bgm || !gate || !startBtn || !toggleBtn) return;

  bgm.volume = 0.3;
  gate.style.display = "flex";

  // ===== Start =====
  startBtn.onclick = () => {
    const time = localStorage.getItem("bgmTime");
    if (time) bgm.currentTime = parseFloat(time);

    if (localStorage.getItem("bgmOn") !== "false") {
      bgm.play().catch(() => {});
    }

    gate.style.display = "none";
  };

  // ===== Toggle =====
  let bgmOn = localStorage.getItem("bgmOn");
  if (bgmOn === null) bgmOn = "true";

  function updateBtn() {
    toggleBtn.innerText = bgmOn === "true" ? "🎵 ON" : "🔇 OFF";
    toggleBtn.classList.toggle("off", bgmOn !== "true");
  }

  updateBtn();

  toggleBtn.onclick = () => {
    bgmOn = bgmOn === "true" ? "false" : "true";
    localStorage.setItem("bgmOn", bgmOn);

    bgmOn === "true" ? bgm.play().catch(() => {}) : bgm.pause();
    updateBtn();
  };

  // ===== Save Time =====
  setInterval(() => {
    if (!bgm.paused) {
      localStorage.setItem("bgmTime", bgm.currentTime);
    }
  }, 1000);
});

// ======================
// 留言系统（使用同一个 client）
// ======================
window.sendMessage = async function () {
  const name = document.getElementById('msgName').value.trim();
  const content = document.getElementById('msgContent').value.trim();

  if (!content) {
    alert("你倒是说句话啊！");
    return;
  }

  const { error } = await client
    .from('messages')
    .insert([{ 
      name: name || '匿名', 
      content 
    }]);

  if (error) {
    console.error(error);
    alert("发送失败，看一下 Console");
    return;
  }

  document.getElementById('msgContent').value = '';
  loadMessages();
};

async function loadMessages() {
  const { data, error } = await client
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  const list = document.getElementById('messageList');
  list.innerHTML = '';

  data.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg';
    div.textContent = `${m.name}：${m.content}`;
    list.appendChild(div);
  });

  // 自动滚到最下面
  list.scrollTop = list.scrollHeight;
}

// 页面加载时拉留言
loadMessages();


// ======================
// 注册百业成员
// ======================
async function registerMember() {
  const userId = document.getElementById("userId").value.trim();
  const pin = document.getElementById("pin").value.trim();
  const nickname = document.getElementById("nickname").value.trim();
  const msg = document.getElementById("msg");

  msg.innerText = "";

  if (!userId) {
    msg.innerText = "游戏ID不能为空";
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    msg.innerText = "密码必须是 4 位数字";
    return;
  }

  // 查重
  const { data: exist, error: checkErr } = await client
    .from("baiye_members")
    .select("id")
    .eq("user_id", userId);

  if (checkErr) {
    console.error("Supabase error:", checkErr);
    msg.innerText = checkErr.message;
    return;
  }


  if (exist.length > 0) {
    msg.innerText = "这个游戏ID已经被注册了";
    return;
  }

  // 插入
  const { error } = await client
    .from("baiye_members")
    .insert({
      user_id: userId,
      password: pin,
      nickname: nickname || null
    });

if (error) {
console.error("INSERT error:", error);
msg.innerText = error.message;
return;
}


  msg.innerText = "注册成功，欢迎加入百业 🎉";

  // 清空输入
  document.getElementById("userId").value = "";
  document.getElementById("pin").value = "";
  document.getElementById("nickname").value = "";

  // 重新加载花名册
  loadMembers();
}

// ======================
// 花名册加载
// ======================
let selectedUserId = null;

async function loadMembers() {
  const { data, error } = await client
    .from("baiye_members")
    .select("user_id, nickname")
    .order("created_at");

  if (error) {
    console.error(error);
    return;
  }

  const list = document.getElementById("memberList");
  list.innerHTML = "";

  const totalSlots = Math.max(data.length + 1, data.length);
  const columns = calcColumns(totalSlots);

  // 🔥 动态设置列数
  list.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

  const current = localStorage.getItem("currentUser");

  // 已注册成员
  data.forEach(member => {
    const div = document.createElement("div");
    div.className = "member";

    if (member.user_id === current) {
      div.classList.add("me");
    }

    div.innerHTML = `
      <div class="avatar"></div>
      <div class="name">
        ${member.nickname || member.user_id}
      </div>
    `;

    div.onclick = () => selectMember(div, member.user_id, member.nickname);
    list.appendChild(div);
  });

  // + 注册位（只要没满）
  if (data.length < MAX_MEMBERS) {
    const empty = document.createElement("div");
    empty.className = "member empty";
    empty.innerText = "+";
    empty.onclick = openRegister;
    list.appendChild(empty);
  }
}

function calcColumns(count) {
  return Math.ceil(Math.sqrt(count));
}

// ======================
// 选择花名
// ======================
function selectMember(userId, nickname) {
  selectedUserId = userId;

  const name = nickname
    ? `${userId}（${nickname}）`
    : userId;

  document.getElementById("selectedName").innerText =
    `当前选择：${name}`;

  // ⭐ 这一句必须要
  document.getElementById("loginArea").style.display = "block";

  document.getElementById("loginMsg").innerText = "";
  document.getElementById("loginPin").value = "";
}


// ======================
// 验证 4 位密码
// ======================
async function verifyPin() {
  const pin = document.getElementById("loginPin").value.trim();
  const msg = document.getElementById("loginMsg");

  msg.innerText = "";

  if (!selectedUserId) {
    msg.innerText = "请先选择花名";
    return;
  }

  if (!/^\d{4}$/.test(pin)) {
    msg.innerText = "请输入 4 位数字密码";
    return;
  }

  const { data, error } = await client
    .from("baiye_members")
    .select("user_id, nickname")
    .eq("user_id", selectedUserId)   // ✅ 这里
    .eq("password", pin)
    .single();

  if (error || !data) {
    msg.innerText = "密码不正确";
    return;
  }

  msg.innerText = `验证成功，欢迎你 ${data.nickname || data.user_id} 👋`;
  localStorage.setItem("currentUser", selectedUserId);
  loadMembers();
}

// 页面加载时自动拉花名册
loadMembers();
