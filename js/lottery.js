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

    const testSpinBtn =
        document.getElementById(
            "testSpinBtn"
        );

    const winnerText =
        document.getElementById(
            "winnerText"
        );

    let participants = [];

    let currentRotation = 0;
    let spinning = false;
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
    async function drawWheel()
    {
        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        if(participants.length === 0)
        {
            ctx.fillStyle = "#fff";

            ctx.font = "40px serif";

            ctx.textAlign = "center";

            ctx.fillText(
                "暂无报名成员",
                400,
                400
            );

            return;
        }

        const center = 400;

        const radius = 350;

        const arc =
            Math.PI * 2 /
            participants.length;

        for(
            let index = 0;
            index < participants.length;
            index++
        )
        {
            const p =
                participants[index];

            const start =
                index * arc;

            const end =
                start + arc;

            // ===== 扇形 =====

            ctx.beginPath();

            ctx.moveTo(
                center,
                center
            );

            ctx.arc(
                center,
                center,
                radius,
                start,
                end
            );

            ctx.fillStyle =
                colors[
                    index %
                    colors.length
                ];

            ctx.fill();

            // ===== 头像 =====

            const img =
                avatarCache[
                    p.avatar
                ];

            if(img)
            {
                const angle =
                    start +
                    arc / 2;

                const avatarDistance =
                    radius * 0.72;

                const x =
                    center +
                    Math.cos(angle)
                    * avatarDistance;

                const y =
                    center +
                    Math.sin(angle)
                    * avatarDistance;

                const size = 70;

                ctx.save();

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    size / 2,
                    0,
                    Math.PI * 2
                );

                ctx.clip();

                ctx.drawImage(
                    img,
                    x - size / 2,
                    y - size / 2,
                    size,
                    size
                );

                ctx.restore();

                // 金边

                ctx.beginPath();

                ctx.arc(
                    x,
                    y,
                    size / 2,
                    0,
                    Math.PI * 2
                );

                ctx.strokeStyle =
                    "#fff";

                ctx.lineWidth = 3;

                ctx.stroke();
            }

            // ===== 名字 =====

            ctx.save();

            ctx.translate(
                center,
                center
            );

            ctx.rotate(
                start +
                arc / 2
            );

            ctx.fillStyle =
                "#111";

            ctx.font =
                "bold 18px serif";

            ctx.textAlign =
                "center";

            ctx.fillText(
                p.name,
                radius - 120,
                55
            );

            ctx.restore();
        }
    }
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

            winnerText.innerHTML = `
                🎉 恭喜<br>
                <strong>${winner.name}</strong><br>
                获得本次奇遇！
            `;

            // 🎯 3. 写数据库（只写一次！）
            if (saveWinner) {

                const { data, error } = await supabase
                    .from("baiye_lottery_winners")
                    .insert({
                        winner_id: winner.id,
                        winner_name: winner.name
                    });

                console.log("winner saved:", data, error);

                // ⭐ 关键：刷新列表
                await loadWinnerList();
            }

            spinning = false;

        }, 8000);
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
            .select("winner_name, created_at")
            .order("id", { ascending: false })
            .limit(20);

        if (error) {
            console.log(error);
            return;
        }

        const list = document.getElementById("winnerList");

        if (!list) {
            console.log("winnerList not found in HTML");
            return;
        }

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
    /* ======================
       事件
    ====================== */

    joinBtn.onclick =
        joinLottery;

    spinBtn.onclick =
        () => spin(true);

    if (testSpinBtn) {

        testSpinBtn.onclick =
            () => spin(false);
    }

    /* ======================
       初始化
    ====================== */

    await loadParticipants();
    await loadWinnerList();

    console.log(
        "Lottery 初始化完成"
    );
}