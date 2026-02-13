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

  // 获取 nickname 和 role
  const { data: memberData, error: memberError } = await client
    .from("baiye_members")
    .select("nickname, role, username")
    .eq("id", user.id)
    .single();

  if (memberError || !memberData) {
    alert("获取用户信息失败");
    return;
  }

  const nickname = memberData.nickname || memberData.username;
  const role = memberData.role || "";
  const username = memberData.username || user.id;

  const timestamp = Date.now();
  const ext = file.name.split(".").pop();
  const filePath = `${user.id}/photos/${timestamp}.${ext}`;

  // 上传到 Supabase Storage
  const { data: uploadData, error: uploadError } = await client.storage
    .from("user-photos")
    .upload(filePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) return alert("上传失败: " + uploadError.message);

  const { data: urlData } = client.storage.from("user-photos").getPublicUrl(filePath);
  const photo_url = urlData.publicUrl;

  // 写入数据库
  const { error } = await client.from("photos").insert({
    user_id: user.id,
    photo_url,
    uploaded_at: new Date().toISOString()
  });

  if (error) return alert("数据库保存失败: " + error.message);

  photoInput.value = "";

  // 直接添加到页面
  addPhotoToList({
    user_id: user.id,
    username,
    nickname,
    role,
    photo_url,
    uploaded_at: new Date().toISOString()
  });
});

/* ======================
   加载所有照片
====================== */
async function loadPhotos() {
  const { data: photos, error } = await client.from("photos")
    .select("*")
    .order("uploaded_at", { ascending: false });

  if (error) return console.error(error);

  photoList.innerHTML = "";

  // 使用 Promise.all 并行获取用户信息
  const photoPromises = photos.map(async (photo) => {
    const { data: memberData } = await client
      .from("baiye_members")
      .select("username, nickname, role")
      .eq("id", photo.user_id)
      .single();

    const username = memberData?.username || photo.user_id;
    const nickname = memberData?.nickname || username;
    const role = memberData?.role || "";

    return {
      ...photo,
      username,
      nickname,
      role
    };
  });

  const photoListData = await Promise.all(photoPromises);

  photoListData.forEach(photo => addPhotoToList(photo));
}

/* ======================
   添加单张照片到列表
====================== */
function addPhotoToList(photo) {
  const displayName = getDisplayNameWithRole(photo);
  const div = document.createElement("div");
  div.className = "photo-post";
  div.innerHTML = `
    <div class="photo-header">
      <span class="display-name">${displayName}</span>
      <span class="time">${new Date(photo.uploaded_at).toLocaleString()}</span>
    </div>
    <img class="photo-img" src="${photo.photo_url}" alt="photo">
  `;
  photoList.prepend(div);
}
 
function getDisplayNameWithRole(photo) {
  // 优先显示花名，如果花名和 username 不同
  let displayName = (photo.nickname && photo.nickname !== photo.username)
    ? photo.nickname
    : photo.username;

  if (photo.role) {
    displayName += `【${photo.role}】`;
  }

  return displayName;
}


/* ======================
   页面加载
====================== */
document.addEventListener("DOMContentLoaded", loadPhotos);
