
/* ======================
   Photos 页面逻辑
====================== */
export async function initPhotos(){
  console.log("初始化 Photos 页面");

  const photoInput=document.getElementById("photoInput");
  const uploadBtn=document.getElementById("uploadBtn");
  const photoList=document.getElementById("photoList");
  if(!photoList) return;

  uploadBtn?.addEventListener("click", async ()=>{
    const file = photoInput.files[0]; if(!file) return alert("请选择照片");

    const { data:{user}, error:userError } = await window.supabaseClient.auth.getUser();
    if(userError||!user) return alert("请先登录才能上传照片");

    const { data: memberData, error: memberError } = await window.supabaseClient.from("baiye_members").select("nickname, role, username").eq("id", user.id).maybeSingle();
    if(memberError||!memberData) return alert("获取用户信息失败");

    const nickname=memberData.nickname||memberData.username;
    const role=memberData.role||"";
    const username=memberData.username||user.id;

    const timestamp=Date.now();
    const ext=file.name.split(".").pop();
    const filePath=`${user.id}/photos/${timestamp}.${ext}`;

    const { error: uploadError } = await window.supabaseClient.storage.from("user-photos").upload(filePath,file,{cacheControl:'3600',upsert:false});
    if(uploadError) return alert("上传失败: "+uploadError.message);

    const { data: urlData } = window.supabaseClient.storage.from("user-photos").getPublicUrl(filePath);
    const photo_url=urlData.publicUrl;

    const { data: insertedPhoto, error: insertError } = await window.supabaseClient.from("photos").insert({ user_id:user.id, photo_url, uploaded_at: new Date().toISOString() }).select().maybeSingle();
    if(insertError) return alert("数据库保存失败: "+insertError.message);

    photoInput.value="";
    await addPhotoToList({ ...insertedPhoto, username, nickname, role }, true);
  });

  /* ======================
     加载所有照片
  ===================== */
  async function loadPhotos() {
    const { data: photos, error } = await window.supabaseClient
      .from("photos")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    photoList.innerHTML = "";

    for (const photo of photos) {
      const { data: memberData } = await window.supabaseClient
        .from("baiye_members")
        .select("username, nickname, role")
        .eq("id", photo.user_id)
        .maybeSingle();

      const username = memberData?.username || photo.user_id;
      const nickname = memberData?.nickname || username;
      const role = memberData?.role || "";

      await addPhotoToList({
        ...photo,
        username,
        nickname,
        role
      }, false);
    }
  }

  /* ======================
     添加单张照片
  ===================== */
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

    if (isNew) {
      photoList.prepend(div);
    } else {
      photoList.appendChild(div);
    }

    const likeBtn = div.querySelector(".like-btn");
    const likeCountSpan = div.querySelector(".like-count");
    const commentsList = div.querySelector(".comments-list");
    const commentInput = div.querySelector(".comment-input");
    const commentBtn = div.querySelector(".comment-btn");

    const { data: { user } } = await window.supabaseClient.auth.getUser();

    /* ===== 加载点赞数 ===== */
    async function loadLikes() {
      const { count } = await window.supabaseClient
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("photo_id", photoId);

      likeCountSpan.textContent = count || 0;
    }

    /* ===== 加载评论 ===== */
    async function loadComments() {
      const { data: comments } = await window.supabaseClient
        .from("comments")
        .select("*, baiye_members(username,nickname)")
        .eq("photo_id", photoId)
        .order("created_at", { ascending: true });

      commentsList.innerHTML = "";

      comments?.forEach(c => {
        const name = c.baiye_members?.nickname || c.baiye_members?.username || "匿名";
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
      await window.supabaseClient.from("likes").upsert(
        { photo_id: photoId, user_id: user.id },
        { onConflict: ['photo_id', 'user_id'] }
      );
      await loadLikes();
    });

    /* ===== 评论 ===== */
    commentBtn.addEventListener("click", async () => {
      const text = commentInput.value.trim();
      if (!text) return;

      await window.supabaseClient.from("comments").insert({
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
  ===================== */
  function getDisplayNameWithRole(photo) {
    let displayName = (photo.nickname && photo.nickname !== photo.username)
      ? photo.nickname
      : photo.username;
    if (photo.role) displayName += `【${photo.role}】`;
    return displayName;
  }


  //放大图片
  const modal = document.getElementById("imageModal");
  const modalImg = document.getElementById("modalImg");

  // 点击图片放大
  document.addEventListener("click", function (e) {
    if (e.target.classList.contains("photo-img")) {
      modalImg.src = e.target.src;
      modal.classList.add("active");
    }
  });

  // 点击遮罩或图片本身关闭
  modal.addEventListener("click", function () {
    modal.classList.remove("active");
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      modal.classList.remove("active");
    }
  });


  /* ======================
     页面初始化
  ===================== */
  loadPhotos();

  // 暴露给 HTML
  window.initPhotos = initPhotos;
}
