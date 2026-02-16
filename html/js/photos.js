
/* ======================
   Photos 页面逻辑
====================== */
export async function initPhotos(){
  console.log("初始化 Photos 页面");

  const photoInput=document.getElementById("photoInput");
  const uploadBtn=document.getElementById("uploadBtn");
  const photoList=document.getElementById("photoList");
  if(!photoList) return;

  uploadBtn.addEventListener("click", async () => {
    const file = photoInput.files[0];
    if (!file) return;

    const titleInput = document.getElementById("photoTitle");
    const title = titleInput.value.trim();
    if (!title) return alert("标题没写...不 通 过");

    const { data: userData } = await window.supabaseClient.auth.getUser();
    const user = userData.user;
    if (!user) return alert("你都没登录！返回主页");

    const fileName = Date.now() + "-" + file.name;

    const { error: uploadError } =
      await window.supabaseClient.storage
        .from("photos")
        .upload(fileName, file);

    if (uploadError) return alert("上传失败");

    const photo_url =
      window.supabaseClient.storage
        .from("photos")
        .getPublicUrl(fileName).data.publicUrl;

    const { data: insertedPhoto, error: insertError } =
      await window.supabaseClient
        .from("photos")
        .insert({
          user_id: user.id,
          photo_url,
          title,
          uploaded_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();

    if (insertError) return alert("保存失败");

    // 👇👇👇 就写在这里
    titleInput.value = "";
    photoInput.value = "";

    addPhotoToList(insertedPhoto, true);
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
    
    const { data: { user } } = await window.supabaseClient.auth.getUser();

    const displayName = getDisplayNameWithRole(photo);
    const photoId = photo.id;

    const div = document.createElement("div");
    div.className = "photo-post";
    div.innerHTML = `
      <div class="photo-header">
        <span class="display-name">${displayName}</span>

        ${user && user.id === photo.user_id ? `
          <div class="owner-actions">
            <button class="edit-btn">编辑</button>
            <button class="delete-btn">删除</button>
          </div>
        ` : ""}

        </div>
        
        <div class="photo-title">${photo.title || ""}</div>
        
        <img class="photo-img" src="${photo.photo_url}" alt="photo">
        
        <div class="photo-actions">
        <button class="like-btn">
        <span class="like-icon">❤︎</span>
        <span class="like-count"></span>
        </button>
        <span class="time">${new Date(photo.uploaded_at).toLocaleString()}</span>
        </div>

      <div class="photo-comments">
        <div class="comments-list"></div>
        <input class="comment-input" type="text" placeholder="留个言呗..." />
        <button class="comment-btn">发送</button>
      </div>
    `;


    if (isNew) {
      photoList.prepend(div);
    } else {
      photoList.appendChild(div);
    }

    const likeBtn = div.querySelector(".like-btn");
    const editBtn = div.querySelector(".edit-btn");
    const deleteBtn = div.querySelector(".delete-btn");
    const likeCountSpan = div.querySelector(".like-count");
    const commentsList = div.querySelector(".comments-list");
    const commentInput = div.querySelector(".comment-input");
    const commentBtn = div.querySelector(".comment-btn");

    /* ===== 加载点赞数 ===== */

    async function checkIfLiked() {
      const { data } = await window.supabaseClient
        .from("likes")
        .select("*")
        .eq("photo_id", photoId)
        .eq("user_id", user.id)
        .maybeSingle();

      return !!data;
    }

    async function loadLikes() {
      const { count } = await window.supabaseClient
        .from("likes")
        .select("*", { count: "exact", head: true })
        .eq("photo_id", photoId);

      likeCountSpan.textContent = count || 0;

      const liked = await checkIfLiked();
      const iconSpan = div.querySelector(".like-icon");

      if (liked) {
        iconSpan.textContent = "❤";
        likeBtn.classList.add("liked");
      } else {
        iconSpan.textContent = "⁠♡";
        likeBtn.classList.remove("liked");
      }
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

      //deletePost  & edit
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      const confirmDelete = confirm("确定要删？找不回的喔");
      if (!confirmDelete) return;

      await window.supabaseClient
        .from("photos")
        .delete()
        .eq("id", photoId);

      div.remove();
    });
  }

    if (editBtn) {
    editBtn.addEventListener("click", async () => {

      const newTitle = prompt("又改？！修改标题：", photo.title);
      if (!newTitle) return;

      const { error } = await window.supabaseClient
        .from("photos")
        .update({ title: newTitle })
        .eq("id", photoId);

      if (error) {
        alert("修改失败");
        return;
      }

      // 更新页面显示
      const titleDiv = div.querySelector(".photo-title");
      titleDiv.textContent = newTitle;
    });
  }
  
    /* ===== 点赞 ===== */
    likeBtn.addEventListener("click", async () => {

      const liked = await checkIfLiked();

      if (liked) {
        // 已点赞 → 删除
        await window.supabaseClient
          .from("likes")
          .delete()
          .eq("photo_id", photoId)
          .eq("user_id", user.id);
      } else {
        // 未点赞 → 插入
        await window.supabaseClient
          .from("likes")
          .insert({
            photo_id: photoId,
            user_id: user.id
          });
      }

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
