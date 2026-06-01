import { initHome } from './home.js';
import { initPhotos } from './photos.js';
import { BGMManager } from './bgm.js';
import { initLottery } from './lottery.js';

const app = document.getElementById("app");

/* ======================
   动态加载 CSS（只加载一次）
====================== */
function loadCSSOnce(href, id) {
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href; // 相对于 index.html
    document.head.appendChild(link);
  }
}

/* ======================
   卸载页面专属 CSS
====================== */
function removeCSS(id) {
  const link = document.getElementById(id);
  if (link) link.remove();
}

/* ======================
   加载页面 HTML
====================== */
async function loadPage(page) {
  try {
    const res = await fetch(`pages/${page}`);
    if (!res.ok) throw new Error(`页面 ${page} 加载失败`);
    const html = await res.text();
    app.innerHTML = html;

    // 卸载旧页面专属 CSS
    removeCSS('home-css');
    removeCSS('photos-css');
    removeCSS('lottery-css');
    
    // 页面专属初始化和 CSS
    if (page === "home.html") {
      initHome();
      loadCSSOnce('css/home.css', 'home-css');  // 注意路径相对于 index.html
    }
    if (page === "photos.html") {
      initPhotos();
      loadCSSOnce('css/photos.css', 'photos-css');

      // 返回首页按钮
      const backBtn = document.getElementById('backBtn');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          loadPage('home.html');
        });
      }
    }
    if(page === "lottery.html")
    {
        initLottery();
        loadCSSOnce(
            'css/lottery.css',
            'lottery-css'
        );
    }

  } catch (err) {
    console.error(err);
    app.innerHTML = `<p style="color:red;">加载页面失败：${err.message}</p>`;
  }
}

/* ======================
   SPA 导航事件
====================== */
document.addEventListener("click", (e) => {
  const link = e.target.getAttribute("data-link");
  if (!link) return;
  e.preventDefault();
  loadPage(link);
});

/* ======================
   页面初始化
====================== */
document.addEventListener("DOMContentLoaded", () => {
  // 加载全局样式（字体 + main.css）
  loadCSSOnce('css/main.css', 'main-css');

  // 默认加载首页
  loadPage("home.html");

  // 初始化 BGM
  BGMManager.init();
});

// BGM 开关按钮
const bgmToggleBtn = document.getElementById('bgmToggleBtn');
let isBGMPlaying = true;  // 默认播放

bgmToggleBtn.addEventListener('click', () => {
  if (isBGMPlaying) {
    BGMManager.pause();   // 暂停 BGM
    bgmToggleBtn.textContent = '🔇';
  } else {
    BGMManager.play();    // 播放 BGM
    bgmToggleBtn.textContent = '🎵';
  }
  isBGMPlaying = !isBGMPlaying;
});
