// SPA BGM 管理器
export const BGMManager = (() => {
  let bgm = null;
  let isPlaying = false;

  function init() {
    if (bgm) return; // 已经初始化过
    bgm = document.createElement("audio");
    bgm.id = "bgm";
    bgm.src = "music/bgm.mp3";
    bgm.loop = true;
    bgm.volume = 0.5;
    document.body.appendChild(bgm);

    // 用户第一次点击页面就播放 BGM
    const tryPlay = () => {
      bgm.play()
        .then(() => { 
          isPlaying = true;
          console.log("BGM 开始播放 🎵");
        })
        .catch(err => {
          console.log("BGM 播放被阻止，需要用户交互", err);
        });
      document.removeEventListener("click", tryPlay);
    };
    document.addEventListener("click", tryPlay);
  }

  function play() {
    if (!bgm) init();
    if (!isPlaying) {
      bgm.play().then(() => isPlaying = true).catch(() => {});
    }
  }

  function pause() {
    bgm?.pause();
    isPlaying = false;
  }

  function setVolume(v) {
    if (bgm) bgm.volume = v;
  }

  return { init, play, pause, setVolume };
})();
