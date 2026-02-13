document.addEventListener("DOMContentLoaded", () => {
  const client = window.supabaseClient;
  if (!client) return console.error("Supabase client 未初始化");

  initPhotoUpload(client);
});

function initPhotoUpload(client) {
  const photoInput = document.getElementById("photoInput");
  const uploadBtn = document.getElementById("uploadBtn");
  const photoList = document.getElementById("photoList");

  uploadBtn.addEventListener("click", async () => {
    const file = photoInput.files[0];
    if (!file) return alert("请选择照片");

    const { data: { user } } = await client.auth.getUser();
    if (!user) return alert("请先登录才能上传照片");

    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/photos/${timestamp}.${fileExt}`;

    const { data: uploadData, error: uploadError } = await client.storage
      .from("user-photos")
      .upload(filePath, file, { cacheControl: '3600', upsert: false });

    if (uploadError) return alert("上传失败: " + uploadError.message);

    const { data: urlData } = client.storage.from("user-photos").getPublicUrl(filePath);
    const photo_url = urlData.publicUrl;

    const { error: dbError } = await client.from("photos").insert({
      user_id: user.id,
      photo_url
    });

    if (dbError) return alert("数据库保存失败: " + dbError.message);

    photoInput.value = "";
    loadPhotos(client);
  });

  loadPhotos(client);
}

async function loadPhotos(client) {
  const { data, error } = await client.from("photos").select("*").order("uploaded_at", { ascending: false });
  if (error) return console.error(error);

  const photoList = document.getElementById("photoList");
  photoList.innerHTML = "";

  data.forEach(photo => {
    const div = document.createElement("div");
    div.className = "photo-card";
    div.innerHTML = `
      <img src="${photo.photo_url}" alt="photo">
      <div class="info">上传者: ${photo.user_id}<br>${new Date(photo.uploaded_at).toLocaleString()}</div>
      <div class="actions">
        <button onclick="likePhoto('${photo.id}')">👍 点赞</button>
        <button onclick="commentPhoto('${photo.id}')">💬 留言</button>
      </div>
    `;
    photoList.appendChild(div);
  });
}

function likePhoto(photoId) {
  alert(`点赞功能待实现: ${photoId}`);
}

function commentPhoto(photoId) {
  alert(`留言功能待实现: ${photoId}`);
}
