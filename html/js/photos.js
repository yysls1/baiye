/* ======================
   Supabase client
====================== */
const client = window.supabaseClient;
if (!client) console.error("Supabase client 未初始化");

// DOM
const photoInput = document.getElementById("photoInput");
const uploadBtn = document.getElementById("uploadBtn");
const photoList = document.getElementById("photoList");

/* ======================
   上传照片
====================== */
uploadBtn.addEventListener("click", async () => {
  const file = photoInput.files[0];
  if (!file) return alert("请选择照片");

  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return alert("请先登录才能上传照片");

  const { data: memberData, error: memberError } = await client
    .from("baiye_members")
    .select("nickname, role, username")
    .eq("id", user.id)
    .single();

  if (memberError || !memberData) return alert("获取用户信息失败");

  const nickname = memberData.nickname || memberData.username;
  const role = memberData.role || "";
  const username = memberData.username || user.id;

  const timestamp = Date.now();
  const ext = file.name.split(".").pop();
  const filePath = `${user.id}/photos/${timestamp}.${ext}`;

  const { error: uploadError } = await client.storage
    .from("user-photos")
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) return alert("上传失败: " + uploadError.message);

  const { data: urlData } =
    client.storage.from("user-photos").getPublicUrl(filePath);

  const photo_url = urlData.publicUrl;

  const { data: insertedPhoto, error: insertError } = await client
    .from("photos")
    .insert({
      user_id: user.id,
      photo_url,
      uploaded_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) return alert("数据库保存失败: " + insertError.message);

  photoInput.value = "";

  // 新照片直接插顶部
  await addPhotoToList({
    ...insertedPhoto,
    username,
    nickname,
    role
  }, true);
});

/* ======================
   加载所有照片（最新在上）
====================== */
async function loadPhotos() {
  const { data: photos, error } = await client
    .from("photos")
    .select("*")
    .order("uploaded_at", { ascending: false }); // 最新在前

  if (error) {
    console.error(error);
    return;
  }

  photoList.innerHTML = "";

  for (const photo of photos) {
    const { data: memberData } = await client
      .from("baiye_members")
      .select("username, nickname, role")
      .eq("id", photo.user_id)
      .single();

    const username = memberData?.username || photo.user_id;
    const nickname = memberData?.nickname || username;
    const role = memberData?.role || "";

    await addPhotoToList({
      ...photo,
      username,
      nickname,
      role
    }, false); // 历史数据用 append
  }
}

/* ======================
   添加单张照片
====================== */
async function addPhotoToList(photo, isNew = false) {
  const displayName = getDisplayNameWithRole(photo);
  const photoId = photo.id;

  const div = document.createElement("div");
  div.className = "photo-post";
  div.innerHTML = `
    <div class="photo-header">
      <span class="display-name">${displayName}</span>
      <span class="time">${new Date(photo.uploaded_at).toLocaleString()}</span>
    </div>
    <img class="photo-img" src="${photo.photo_url}" alt="photo">
    <div class="photo-actions">
      <button class="like-btn">❤️ 点赞</button>
      <span class="like-count">0</span>
    </div>
    <div class="photo-comments">
      <div class="comments-list"></div>
      <input class="comment-input" type="text" placeholder="写评论..." />
      <button class="comment-btn">发送</button>
    </div>
  `;

  // ⭐ 关键逻辑
  if (isNew) {
    photoList.prepend(div);  // 新的插最上
  } else {
    photoList.appendChild(div); // 历史数据顺序加载
  }

  const likeBtn = div.querySelector(".like-btn");
  const likeCountSpan = div.querySelector(".like-count");
  const commentsList = div.querySelector(".comments-list");
  const commentInput = div.querySelector(".comment-input");
  const commentBtn = div.querySelector(".comment-btn");

  const { data: { user } } = await client.auth.getUser();

  /* ===== 加载点赞数 ===== */
  async function loadLikes() {
    const { count } = await client
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("photo_id", photoId);

    likeCountSpan.textContent = count || 0;
  }

  /* ===== 加载评论 ===== */
  async function loadComments() {
    const { data: comments } = await client
      .from("comments")
      .select("*, baiye_members(username,nickname)")
      .eq("photo_id", photoId)
      .order("created_at", { ascending: true });

    commentsList.innerHTML = "";

    comments?.forEach(c => {
      const name =
        c.baiye_members?.nickname ||
        c.baiye_members?.username ||
        "匿名";

      const cDiv = document.createElement("div");
      cDiv.className = "comment";
      cDiv.textContent = `${name}: ${c.comment_text}`;
      commentsList.appendChild(cDiv);
    });
  }

  await loadLikes();
  await loadComments();

  if (!user) return;

  /* ===== 点赞 ===== */
  likeBtn.addEventListener("click", async () => {
    await client.from("likes").upsert(
      { photo_id: photoId, user_id: user.id },
      { onConflict: ['photo_id', 'user_id'] }
    );
    await loadLikes();
  });

  /* ===== 评论 ===== */
  commentBtn.addEventListener("click", async () => {
    const text = commentInput.value.trim();
    if (!text) return;

    await client.from("comments").insert({
      photo_id: photoId,
      user_id: user.id,
      comment_text: text
    });

    commentInput.value = "";
    await loadComments();
  });
}

/* ======================
   显示昵称 + 称号
====================== */
function getDisplayNameWithRole(photo) {
  let displayName =
    (photo.nickname && photo.nickname !== photo.username)
      ? photo.nickname
      : photo.username;

  if (photo.role) displayName += `【${photo.role}】`;

  return displayName;
}

/* ======================
   页面加载
====================== */
document.addEventListener("DOMContentLoaded", loadPhotos);
