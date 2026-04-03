(function () {
  const ADMIN_KEY = "ranking-is-admin";
  const COLLECTION = "timeRecords";

  const form = document.getElementById("record-form");
  const nameInput = document.getElementById("name");
  const minutesInput = document.getElementById("minutes");
  const secondsInput = document.getElementById("seconds");
  const rankingList = document.getElementById("ranking-list");
  const championZone = document.getElementById("champion-zone");
  const emptyState = document.getElementById("empty-state");
  const recordCount = document.getElementById("record-count");
  const btnClearAll = document.getElementById("btn-clear-all");
  const btnSubmit = document.getElementById("btn-submit");
  const adminPanel = document.getElementById("admin-panel");

  // Firebase 설정값을 여기에 넣어주세요.
  // Firebase 콘솔 > 프로젝트 설정 > 일반 > "앱의 웹 설정" 복사
  const firebaseConfig = {
    apiKey:
      "AIzaSyDeoPCGMncHqLSn1_sOJ4rJc9AS-vbjps8",
    authDomain: "rankingstorage-97abf.firebaseapp.com",
    projectId: "rankingstorage-97abf",
    storageBucket: "rankingstorage-97abf.firebasestorage.app",
    messagingSenderId: "591852913633",
    appId: "1:591852913633:web:baf888626e46debd35c8a0",
  };

  const firebaseReady =
    typeof window.firebase !== "undefined" &&
    firebaseConfig &&
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.startsWith("YOUR_");

  if (!firebaseReady) {
    console.error(
      "Firebase 설정이 비어 있습니다. app.js의 firebaseConfig를 채워주세요."
    );
    emptyState.textContent = "Firebase 설정이 필요합니다. 콘솔을 확인해 주세요.";
    emptyState.classList.remove("hidden");
    recordCount.textContent = "0명";
    return;
  }

  if (!window.firebase.apps || !window.firebase.apps.length) {
    window.firebase.initializeApp(firebaseConfig);
  }
  const db = window.firebase.firestore();

  function isAdminMode() {
    return sessionStorage.getItem(ADMIN_KEY) === "1";
  }

  function setAdminMode(on) {
    if (on) sessionStorage.setItem(ADMIN_KEY, "1");
    else sessionStorage.removeItem(ADMIN_KEY);
    document.body.classList.toggle("is-admin", on);
    adminPanel.hidden = !on;

    const inputs = [nameInput, minutesInput, secondsInput, btnSubmit, btnClearAll];
    inputs.forEach((el) => {
      el.disabled = !on;
    });
  }

  function parseTimeSeconds() {
    const m = parseFloat(minutesInput.value);
    const s = parseFloat(secondsInput.value);
    const min = Number.isFinite(m) && m >= 0 ? m : 0;
    const sec = Number.isFinite(s) && s >= 0 ? s : 0;
    return min * 60 + sec;
  }

  function formatTime(totalSeconds) {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0.000초";
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds - mins * 60;
    if (mins === 0) return `${secs.toFixed(3)}초`;
    return `${mins}분 ${secs.toFixed(3)}초`;
  }

  function assignRanks(sorted) {
    const out = [];
    let prev = null;
    let rank = 0;
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i].timeSeconds;
      if (prev === null || t !== prev) {
        rank = i + 1;
        prev = t;
      }
      out.push({ ...sorted[i], rank });
    }
    return out;
  }

  async function fetchRecords() {
    const snap = await db
      .collection(COLLECTION)
      .orderBy("timeSeconds", "desc")
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data() || {};
      const timeSeconds = Number(data.timeSeconds);
      return {
        id: doc.id,
        name: typeof data.name === "string" ? data.name : "",
        timeSeconds: Number.isFinite(timeSeconds) ? timeSeconds : 0,
      };
    });
  }

  async function deleteRecord(id) {
    await db.collection(COLLECTION).doc(id).delete();
  }

  async function clearAll() {
    const snap = await db.collection(COLLECTION).get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  function renderChampions(champions, admin) {
    championZone.innerHTML = "";
    if (!champions.length) {
      championZone.hidden = true;
      return;
    }
    championZone.hidden = false;

    champions.forEach((r) => {
      const card = document.createElement("article");
      card.className = "champion-card";

      const badge = document.createElement("div");
      badge.className = "champion-badge";
      badge.textContent = champions.length > 1 ? "공동 1위" : "1위";

      const nameEl = document.createElement("h3");
      nameEl.className = "champion-name";
      nameEl.textContent = r.name || "(이름 없음)";

      const timeEl = document.createElement("div");
      timeEl.className = "champion-time";
      timeEl.textContent = formatTime(r.timeSeconds);

      const meta = document.createElement("div");
      meta.className = "champion-meta";

      if (admin) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn-icon";
        del.setAttribute("aria-label", "이 기록 삭제");
        del.textContent = "삭제";
        del.addEventListener("click", async () => {
          await deleteRecord(r.id);
          await render();
        });
        meta.appendChild(del);
      }

      card.appendChild(badge);
      card.appendChild(nameEl);
      card.appendChild(timeEl);
      if (meta.childNodes.length) card.appendChild(meta);
      championZone.appendChild(card);
    });
  }

  async function render() {
    const admin = isAdminMode();

    let records = [];
    try {
      records = await fetchRecords();
    } catch (err) {
      console.error(err);
      emptyState.textContent = "기록을 불러오지 못했습니다. 콘솔을 확인해 주세요.";
      emptyState.classList.remove("hidden");
      recordCount.textContent = "0명";
      return;
    }

    const ranked = assignRanks(records);
    const champions = ranked.filter((x) => x.rank === 1);
    const rest = ranked.filter((x) => x.rank > 1);

    renderChampions(champions, admin);

    rankingList.innerHTML = "";
    rest.forEach((r) => {
      const li = document.createElement("li");
      const tier = r.rank === 2 ? "rank-2" : r.rank === 3 ? "rank-3" : "";
      li.className = tier;
      li.dataset.id = r.id;

      const rankEl = document.createElement("span");
      rankEl.className = "rank-num";
      rankEl.textContent = String(r.rank);

      const nameEl = document.createElement("span");
      nameEl.className = "rank-name";
      nameEl.textContent = r.name || "(이름 없음)";

      const right = document.createElement("div");
      right.style.display = "flex";
      right.style.alignItems = "center";
      right.style.gap = "0.5rem";

      const timeEl = document.createElement("span");
      timeEl.className = "rank-time";
      timeEl.textContent = formatTime(r.timeSeconds);

      right.appendChild(timeEl);
      if (admin) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn-icon";
        del.setAttribute("aria-label", "이 기록 삭제");
        del.textContent = "삭제";
        del.addEventListener("click", async () => {
          await deleteRecord(r.id);
          await render();
        });
        right.appendChild(del);
      }

      li.appendChild(rankEl);
      li.appendChild(nameEl);
      li.appendChild(right);
      rankingList.appendChild(li);
    });

    const n = records.length;
    recordCount.textContent = `${n}명`;
    emptyState.classList.toggle("hidden", n !== 0);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!isAdminMode()) return;

    const total = parseTimeSeconds();
    if (total <= 0) {
      alert("0보다 큰 시간을 입력해 주세요.");
      return;
    }

    const name = (nameInput.value || "").trim().slice(0, 40);
    await db.collection(COLLECTION).add({
      name,
      timeSeconds: total,
      createdAt: Date.now(),
    });

    minutesInput.value = "";
    secondsInput.value = "";
    nameInput.focus();
    await render();
  });

  btnClearAll.addEventListener("click", async () => {
    if (!isAdminMode()) return;
    if (!confirm("모든 기록을 삭제할까요?")) return;
    await clearAll();
    await render();
  });

  // F12 콘솔에서 아래 함수 실행 -> 관리자 모드 온/오프
  window.enableAdminMode = async () => {
    setAdminMode(true);
    nameInput.focus();
    await render();
  };

  window.disableAdminMode = async () => {
    setAdminMode(false);
    await render();
  };

  setAdminMode(isAdminMode());
  render();
})();
