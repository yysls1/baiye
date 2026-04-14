// SPA BGM 管理器（随机播放版）
export const BGMManager = (() => {

  let bgm = null;
  let isPlaying = false;

  const playlist = [
    "music/bgm1.mp3",
    "music/bgm2.mp3",
    "music/bgm3.mp3",
    "music/bgm4.mp3"
  ];

  let currentIndex = -1;

  // 生成一个新的随机索引（避免连续重复）
  function getRandomIndex() {
    let newIndex;
    do {
      newIndex = Math.floor(Math.random() * playlist.length);
    } while (newIndex === currentIndex && playlist.length > 1);
    return newIndex;
  }

  function init() {
    if (bgm) return;

    bgm = document.createElement("audio");
    bgm.id = "bgm";
    bgm.volume = 0.5;
    document.body.appendChild(bgm);

    function playRandom() {
      currentIndex = getRandomIndex();
      bgm.src = playlist[currentIndex];
      bgm.play()
        .then(() => {
          isPlaying = true;
          console.log("正在播放:", playlist[currentIndex]);
        })
        .catch(() => {});
    }

    // 播放结束 → 再随机一首
    bgm.addEventListener("ended", () => {
      playRandom();
    });

    // 用户第一次点击后开始播放
    const tryPlay = () => {
      playRandom();
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
