import supabase from "./supabase.js";

export async function initLottery() {

    const canvas =
        document.getElementById("wheel");

    const ctx =
        canvas.getContext("2d");

    const joinBtn =
        document.getElementById(
            "joinLotteryBtn"
        );

    const spinBtn =
        document.getElementById(
            "spinBtn"
        );

    const winnerText =
        document.getElementById(
            "winnerText"
        );

    let participants = [];
    let hueOffset = 0;
    let currentRotation = 0;
    let spinning = false;
    let velocity = 0;
    let spinningPhysics = false;
    let targetIndex = null;
    
    const avatarCache = {};
   
    const colors = [
        "#FFD700",
        "#FF9900",
        "#C53030",
        "#2B6CB0",
        "#2F855A",
        "#805AD5"
    ];

    /* ======================
       报名
    ====================== */
    async function joinLottery() {

        const {
            data: { user }
        } =
        await supabase.auth.getUser();

        if (!user) {
            alert("请先登录");
            return;
        }

        const { error } =
            await supabase
            .from("baiye_lottery")
            .insert({
                user_id: user.id
            });

        if (error) {
            alert("已经报名过了");
            return;
        }

        alert("报名成功");

        await loadParticipants();
    }

    /* ======================
       读取名单
    ====================== */
    async function loadParticipants() {

        try {

            const {
                data: lotteryData,
                error
            }
            =
            await supabase
            .from("baiye_lottery")
            .select("user_id");

            if (error)
                throw error;

            if (!lotteryData?.length) {

                participants = [];

                drawWheel();

                return;
            }

            const ids =
                lotteryData.map(
                    x => x.user_id
                );

            const {
                data: members,
                error: memberError
            }
            =
            await supabase
            .from("baiye_members")
            .select(`
                id,
                username,
                nickname,
                avatar_url
            `)
            .in("id", ids);

            if (memberError)
                throw memberError;

           participants =
            (members || []).map(m => ({

                id: m.id,

                name:
                    m.nickname ||
                    m.username,

                avatar:
                    m.avatar_url ||
                    "img/default-avatar.png"
            }));

            for(const p of participants)
            {
                await loadAvatar(
                    p.avatar
                );
            }

            await drawWheel();

        }
        catch (err) {

            console.error(
                "读取失败",
                err
            );
        }

    }

    /* ======================
       绘制转盘
    ====================== */
    async function drawWheel() {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const dpr = window.devicePixelRatio || 1;
        const size = canvas.width / dpr;

        const center = size / 2;
        const radius = size * 0.42;
        // ======================
        // 空状态
        // ======================
        if (participants.length === 0) {

            ctx.fillStyle = "#00f6ff";
            ctx.font = "40px monospace";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.shadowColor = "#00f6ff";
            ctx.shadowBlur = 20;

            ctx.fillText("暂无报名成员", center, center);

            ctx.shadowBlur = 0;
            return;
        }

        const arc = (Math.PI * 2) / participants.length;

        // ======================
        // 扇区
        // ======================
        for (let index = 0; index < participants.length; index++) {

            const p = participants[index];

            const start = index * arc;
            const end = start + arc;

            const hue = (index * 28 + hueOffset) % 360;

            // ======================
            // 🌈 霓虹渐变
            // ======================
            const gradient = ctx.createRadialGradient(
                center, center, 0,
                center, center, radius
            );

            gradient.addColorStop(0, `hsla(${hue}, 100%, 65%, 1)`);
            gradient.addColorStop(0.4, `hsla(${hue + 15}, 100%, 45%, 1)`);
            gradient.addColorStop(1, `hsla(${hue + 60}, 100%, 15%, 1)`);

            ctx.fillStyle = gradient;

            ctx.shadowColor = `hsla(${hue}, 100%, 60%, 0.8)`;
            ctx.shadowBlur = 18;

            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, radius, start, end);
            ctx.closePath();
            ctx.fill();

            ctx.shadowBlur = 0;

            // ======================
            // 分割线
            // ======================
            ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.35)`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // ======================
            // ⭐ 头像（往中心收，避免冲突）
            // ======================
            const img = avatarCache[p.avatar];

            if (img) {

                const angle = start + arc / 2;

                const avatarDistance = radius * 0.70;
                const x = center + Math.cos(angle) * avatarDistance;
                const y = center + Math.sin(angle) * avatarDistance;

                const size = radius * 0.20;

                ctx.save();

                // 👉 移动到头像中心
                ctx.translate(x, y);

                // ⭐关键：让头像跟随扇区方向
                ctx.rotate(angle + Math.PI / 2);

                // ===== 画头像 =====
                ctx.beginPath();
                ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
                ctx.clip();

                ctx.drawImage(img, -size / 2, -size / 2, size, size);

                ctx.restore();

                // ===== 外圈霓虹（不旋转）=====
                ctx.beginPath();
                ctx.arc(x, y, size / 2, 0, Math.PI * 2);

                ctx.strokeStyle = `hsla(${hue}, 100%, 70%, 0.9)`;
                ctx.shadowColor = "#00f6ff";
                ctx.shadowBlur = 12;
                ctx.lineWidth = 2;

                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            // ======================
            // ⭐ 文字（往外推，避免压头像）
            // ======================
            const text = p.name.length > 8
                ? p.name.slice(0, 8) + "…"
                : p.name;

            const fontSize = Math.max(10, 16 - participants.length * 0.15);

            ctx.font = `bold ${fontSize}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.fillStyle = "#00f6ff";
            ctx.shadowColor = "#00f6ff";
            ctx.shadowBlur = 10;

            const textRadius = radius * 0.92; // 👈 关键：推外层

            const startAngle = start + arc * 0.18;
            const endAngle = end - arc * 0.18;

            drawArcText(
                ctx,
                text,
                center,
                center,
                textRadius,
                startAngle,
                endAngle
            );

            ctx.shadowBlur = 0;

        }
    }
    function drawArcText(ctx, text, cx, cy, radius, startAngle, endAngle) {

        const chars = text.split("");
        const step = (endAngle - startAngle) / Math.max(chars.length, 1);

        ctx.save();

        for (let i = 0; i < chars.length; i++) {

            const angle = startAngle + step * i;

            ctx.save();

            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.translate(radius, 0);

            ctx.rotate(Math.PI / 2);

            ctx.fillText(chars[i], 0, 0);

            ctx.restore();
        }

        ctx.restore();
    }
    function animateWheel() {
        hueOffset += 0.2;
        requestAnimationFrame(animateWheel);

        // 只有有数据时才重绘，避免浪费性能
        if (participants.length > 0) {
            drawWheel();
        }
    }

    animateWheel();
    
    function physicsLoop() {

        if (!spinningPhysics) return;

        // ===== 摩擦（越小越滑）=====
        const friction = 0.985;

        velocity *= friction;

        currentRotation += velocity;

        // 更新 canvas 旋转
        canvas.style.transform = `rotate(${currentRotation}deg)`;

        // ===== 停止条件 =====
        if (Math.abs(velocity) < 0.05) {

            spinningPhysics = false;
            velocity = 0;

            onSpinEnd();
            return;
        }

        requestAnimationFrame(physicsLoop);
    }

    function resizeCanvas() {

        const size = Math.min(window.innerWidth * 0.92, 600);
        const dpr = window.devicePixelRatio || 1;

        canvas.style.width = size + "px";
        canvas.style.height = size + "px";

        canvas.width = size * dpr;
        canvas.height = size * dpr;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    /* ======================
       权限检查
    ====================== */
    async function canSpinLottery() {

        const {
            data: { user }
        } =
        await supabase.auth.getUser();

        if (!user)
            return false;

        const {
            data,
            error
        }
        =
        await supabase
        .from("baiye_members")
        .select("priority")
        .eq("id", user.id)
        .single();

        if (
            error ||
            !data
        )
            return false;

        return (
            data.priority === 1
        );
    }

    /* ======================
       抽奖
       saveWinner=true
       正式抽奖

       saveWinner=false
       测试抽奖
    ====================== */
    async function spin(saveWinner = true)
    {
        const isTest = saveWinner === false;
        const prefix = isTest ? "[测试] " : "";

        if (saveWinner) {
            const isAdmin = await canSpinLottery();

            if (!isAdmin) {
                alert("抽奖时间未开启(派对开启)");
                return;
            }
        }

        if (spinning) return;

        if (participants.length === 0) {
            alert("暂无报名成员");
            return;
        }

        spinning = true;

        // 🎯 1. 先抽 winner
        const winnerIndex =
            Math.floor(Math.random() * participants.length);

        const winner = participants[winnerIndex];

        const arc = 360 / participants.length;

        const winnerCenterAngle =
            winnerIndex * arc + arc / 2;

        const pointerAngle = 270;

        const currentAngle = currentRotation % 360;

        let rotateTo =
            pointerAngle - winnerCenterAngle - currentAngle;

        if (rotateTo < 0) rotateTo += 360;

        currentRotation += 360 * 8 + rotateTo;

        canvas.style.transition =
            "transform 8s cubic-bezier(.15,.85,.15,1)";

        canvas.style.transform =
            `rotate(${currentRotation}deg)`;

        // 🎯 2. 等动画结束
        setTimeout(async () => {
            if (navigator.vibrate) {
                navigator.vibrate([80, 30, 120, 40, 200]);
            }

            const displayName = prefix + winner.name;

            winnerText.innerHTML = `
                🎉 恭喜<br>
                <strong>${displayName}</strong><br>
                获得本次奇遇！
            `;

            // 🎯 3. 写数据库（只写一次）
            const { data, error } = await supabase
                .from("baiye_lottery_winners")
                .insert({
                    winner_id: winner.id,
                    winner_name: displayName
                });

            console.log("winner saved:", data, error);

            // ⭐ 刷新列表
            await loadWinnerList();
            await loadTestWinnerList();
            spinning = false;

        }, 8000);
    }
    async function onSpinEnd() {

        const winner = participants[winnerIndex];
        const prefix = "[测试] ";

        const displayName = prefix + winner.name;

        winnerText.innerHTML = `
            🎉 恭喜<br>
            <strong>${displayName}</strong><br>
            获得本次奇遇！
        `;

        await supabase
            .from("baiye_lottery_winners")
            .insert({
                winner_id: winner.id,
                winner_name: displayName
            });

        await loadWinnerList();
        await loadTestWinnerList();
    }
    async function loadAvatar(url)
    {
        return new Promise((resolve)=>{

            if(avatarCache[url])
            {
                resolve(
                    avatarCache[url]
                );
                return;
            }

            const img =
                new Image();

            img.crossOrigin =
                "anonymous";

            img.onload = ()=>{

                avatarCache[url] =
                    img;

                resolve(img);
            };

            img.onerror =
                ()=>resolve(null);

            img.src = url;
        });
    }
    async function loadWinnerList() {

        const { data, error } = await supabase
            .from("baiye_lottery_winners")
            .select("winner_name")
            .not("winner_name", "like", "[测试]%")
            .order("id", { ascending: false })
            .limit(20);

        if (error) return;

        const list = document.getElementById("winnerList");

        if (!list) return;

        list.innerHTML = "";

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="winner-item">暂无中奖记录</div>`;
            return;
        }

        data.forEach(item => {

            const div = document.createElement("div");
            div.className = "winner-item";

            div.textContent = `🎉 ${item.winner_name}`;

            list.appendChild(div);
        });
    }
    async function loadTestWinnerList() {

        const { data, error } = await supabase
            .from("baiye_lottery_winners")
            .select("winner_name")
            .like("winner_name", "[测试]%")
            .order("id", { ascending: false })
            .limit(20);

        if (error) {
            console.log(error);
            return;
        }

        const list = document.getElementById("testWinnerList");

        if (!list) return;

        list.innerHTML = "";

        if (!data || data.length === 0) {
            list.innerHTML = `<div class="winner-item">暂无测试记录</div>`;
            return;
        }

        data.forEach(item => {

            const div = document.createElement("div");
            div.className = "winner-item";

            div.textContent = `🧪 ${item.winner_name.replace("[TEST] ", "")}`;

            list.appendChild(div);
        });
    }
    /* ======================
       事件
    ====================== */

    joinBtn.onclick =
        joinLottery;

    spinBtn.onclick =
        () => spin(true);
    
    testSpinBtn.onclick = () => spin(false); // 测试
    
    /* ======================
       初始化
    ====================== */

    await loadParticipants();
    await loadWinnerList();
    await loadTestWinnerList();

    console.log(
        "Lottery 初始化完成"
    );
}