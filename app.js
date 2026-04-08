const STORAGE_KEY = "morningRoomData";
const DEFAULT_STATE = {
  idealDeskImage: "",
  lastDeskImage: "",
  points: 0,
  ownedItems: ["desk", "chair", "cushion", "closet", "clock"],
  roomState: "clean",
  streak: 0,
  mealData: { rawText: "", todayMenu: "" },
  isFirstLaunch: true,
};

const SHOP_ITEMS = [
  { id: "plant", label: "観葉植物", cost: 200 },
  { id: "lamp", label: "ランプ", cost: 220 },
  { id: "bookshelf", label: "本棚", cost: 300 },
  { id: "carpet", label: "カーペット", cost: 180 },
  { id: "poster", label: "ポスター", cost: 160 },
  { id: "whiteboard", label: "ホワイトボード", cost: 260 },
  { id: "humidifier", label: "加湿器", cost: 280 },
  { id: "speaker", label: "スピーカー", cost: 240 },
  { id: "bedside-table", label: "サイドテーブル", cost: 210 },
  { id: "storage-box", label: "収納ボックス", cost: 170 },
];

const REQUIRED_ITEMS = ["desk", "chair", "cushion", "closet", "clock"];
const MORNING_ORDER = ["洗顔", "歯磨き", "日焼け止め", "教科書確認", "バッグ準備"];

let state = loadState();

const pointValue = document.querySelector("#point-value");
const dailyScore = document.querySelector("#daily-score");
const morningSteps = document.querySelector("#morning-steps");
const mealToday = document.querySelector("#meal-today");
const weatherText = document.querySelector("#weather-text");
const outfitText = document.querySelector("#outfit-text");
const roomGrid = document.querySelector("#room-grid");
const roomCompletionText = document.querySelector("#room-completion-text");
const roomProgressBar = document.querySelector("#room-progress-bar");
const shopItems = document.querySelector("#shop-items");
const pdfStatus = document.querySelector("#pdf-status");
const pdfPreview = document.querySelector("#pdf-preview");
const checkSummary = document.querySelector("#check-summary");
const differenceList = document.querySelector("#difference-list");

const setupDialog = document.querySelector("#setup-dialog");
const idealDeskInput = document.querySelector("#ideal-desk-input");
const idealPreview = document.querySelector("#ideal-preview");
const currentDeskInput = document.querySelector("#current-desk-input");
const mealPdfInput = document.querySelector("#meal-pdf-input");
const openSetup = document.querySelector("#open-setup");

bindEvents();
renderAll();
loadWeatherAndAdvice();
registerServiceWorker();
if (state.isFirstLaunch) {
  setupDialog.showModal();
}

function bindEvents() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  openSetup.addEventListener("click", () => setupDialog.showModal());

  idealDeskInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    state.idealDeskImage = dataUrl;
    idealPreview.src = dataUrl;
    idealPreview.style.display = "block";
  });

  document.querySelector("#save-setup").addEventListener("click", () => {
    if (!state.idealDeskImage) return;
    state.isFirstLaunch = false;
    saveState();
  });

  currentDeskInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file || !state.idealDeskImage) {
      checkSummary.textContent = "先に理想の机を登録してください。";
      return;
    }
    const currentDataUrl = await fileToDataUrl(file);
    state.lastDeskImage = currentDataUrl;
    const result = await compareDeskImages(state.idealDeskImage, currentDataUrl);
    applyScore(result.score);
    renderDifference(result);
    saveState();
    renderAll();
  });

  mealPdfInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await parseMealPdf(file);
    saveState();
    renderAll();
  });
}

function switchView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.id === `view-${viewName}`);
  });
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === viewName);
  });
}

function renderAll() {
  pointValue.textContent = state.points;
  dailyScore.textContent = calculateDailyScore();

  morningSteps.innerHTML = "";
  MORNING_ORDER.forEach((step) => {
    const li = document.createElement("li");
    li.textContent = step;
    morningSteps.appendChild(li);
  });

  mealToday.textContent = state.mealData.todayMenu || "PDFを読み込むと表示されます。";
  pdfPreview.textContent = state.mealData.rawText || "";
  pdfStatus.textContent = state.mealData.rawText ? "読み込み済み" : "未読み込み";

  roomGrid.innerHTML = "";
  roomGrid.appendChild(renderRoomScene(state.ownedItems));

  const completion = calculateRoomCompletion(state.ownedItems);
  roomCompletionText.textContent = `完成度 ${completion}%`;
  roomProgressBar.style.width = `${completion}%`;

  shopItems.innerHTML = "";
  SHOP_ITEMS.forEach((item) => {
    const row = document.createElement("div");
    row.className = "shop-row";
    const owned = state.ownedItems.includes(item.id);
    row.innerHTML = `<span class="shop-item-name">${item.label}</span><span class="shop-item-cost">${item.cost}pt</span>`;
    const button = document.createElement("button");
    button.textContent = owned ? "所持中" : "購入";
    button.disabled = owned;
    button.addEventListener("click", () => purchaseItem(item));
    row.appendChild(button);
    shopItems.appendChild(row);
  });
}

function applyScore(score) {
  let gained = 0;
  if (score >= 95) {
    gained = 500;
    state.streak += 1;
  } else if (score >= 80) {
    gained = 300;
    state.streak += 1;
  } else {
    state.streak = 0;
    state.points = Math.max(0, state.points - 50);
    state.roomState = "messy";
  }

  if (state.streak >= 2) {
    gained += 100;
  }

  state.points += gained;
  if (score >= 80) {
    state.roomState = "clean";
  }
}

function purchaseItem(item) {
  if (state.points < item.cost) return;
  state.points -= item.cost;
  state.ownedItems.push(item.id);
  saveState();
  renderAll();
}

async function compareDeskImages(idealDataUrl, currentDataUrl) {
  const [idealImage, currentImage] = await Promise.all([loadImage(idealDataUrl), loadImage(currentDataUrl)]);
  const w = 240;
  const h = 160;

  const idealCanvas = document.createElement("canvas");
  const currentCanvas = document.createElement("canvas");
  idealCanvas.width = currentCanvas.width = w;
  idealCanvas.height = currentCanvas.height = h;

  const ictx = idealCanvas.getContext("2d");
  const cctx = currentCanvas.getContext("2d");
  ictx.drawImage(idealImage, 0, 0, w, h);
  cctx.drawImage(currentImage, 0, 0, w, h);

  const idealData = ictx.getImageData(0, 0, w, h).data;
  const currentData = cctx.getImageData(0, 0, w, h).data;

  const zones = [
    { name: "left", x: 0, y: 0, width: 80, height: 80 },
    { name: "center", x: 80, y: 0, width: 80, height: 80 },
    { name: "right", x: 160, y: 0, width: 80, height: 80 },
    { name: "front", x: 0, y: 80, width: 240, height: 80 },
  ];

  const issues = [];
  zones.forEach((zone, index) => {
    const delta = zoneDifference(idealData, currentData, w, zone);
    if (delta > 30) {
      const types = ["位置ズレ", "紛失リスク", "不足", "要処分候補"];
      issues.push({
        type: types[index % types.length],
        message: `${zone.name}エリアの差分が大きいです。`,
        crop: cropDataUrl(currentCanvas, zone),
      });
    }
  });

  const rawScore = Math.max(0, 100 - issues.length * 18);
  return { score: rawScore, issues };
}

function zoneDifference(idealData, currentData, width, zone) {
  let total = 0;
  let count = 0;
  for (let y = zone.y; y < zone.y + zone.height; y += 2) {
    for (let x = zone.x; x < zone.x + zone.width; x += 2) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(idealData[idx] - currentData[idx]);
      const dg = Math.abs(idealData[idx + 1] - currentData[idx + 1]);
      const db = Math.abs(idealData[idx + 2] - currentData[idx + 2]);
      total += (dr + dg + db) / 3;
      count += 1;
    }
  }
  return total / count;
}

function cropDataUrl(canvas, zone) {
  const cropCanvas = document.createElement("canvas");
  cropCanvas.width = zone.width;
  cropCanvas.height = zone.height;
  const ctx = cropCanvas.getContext("2d");
  ctx.drawImage(canvas, zone.x, zone.y, zone.width, zone.height, 0, 0, zone.width, zone.height);
  return cropCanvas.toDataURL("image/jpeg", 0.8);
}

function renderDifference(result) {
  checkSummary.textContent = `整いスコア ${result.score} / 100`;
  differenceList.innerHTML = "";

  if (!result.issues.length) {
    differenceList.textContent = "理想にかなり近い状態です。";
    return;
  }

  const template = document.querySelector("#difference-template");
  result.issues.forEach((issue) => {
    const node = template.content.cloneNode(true);
    node.querySelector("img").src = issue.crop;
    node.querySelector(".difference-type").textContent = issue.type;
    node.querySelector(".difference-message").textContent = issue.message;
    differenceList.appendChild(node);
  });
}

async function parseMealPdf(file) {
  if (!window.pdfjsLib) {
    state.mealData.rawText = "";
    state.mealData.todayMenu = "PDFライブラリの読み込みに失敗しました。再読み込みしてください。";
    return;
  }
  const bytes = await file.arrayBuffer();
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.js";
  const pdf = await pdfjs.getDocument({ data: bytes }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    text += `${pageText}\n`;
  }

  state.mealData.rawText = text.trim();
  state.mealData.todayMenu = extractTodayMeal(text);
}

function extractTodayMeal(rawText) {
  const today = new Date();
  const month = today.getMonth() + 1;
  const date = today.getDate();
  const pattern = new RegExp(`${month}[\\/月\\-.\\s]*${date}`);
  const lines = rawText.split(/\n|。/).map((line) => line.trim()).filter(Boolean);
  const hit = lines.find((line) => pattern.test(line));
  return hit || "今日のメニューを判別できませんでした。PDF内テキストを確認してください。";
}

async function loadWeatherAndAdvice() {
  try {
    const coords = await getCoords();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,precipitation,weather_code,uv_index`;
    const response = await fetch(url);
    const data = await response.json();
    const current = data.current;
    weatherText.textContent = `気温 ${Math.round(current.temperature_2m)}℃ / 降水 ${current.precipitation}mm / UV ${current.uv_index ?? "-"}`;
    outfitText.textContent = buildOutfitAdvice(current.temperature_2m, current.precipitation, current.uv_index);
  } catch {
    weatherText.textContent = "天気を取得できませんでした。";
    outfitText.textContent = "薄手の羽織と日焼け止めを用意すると安心です。";
  }
}

function buildOutfitAdvice(temp, precipitation, uv) {
  const tips = [];
  if (temp < 12) tips.push("厚手の上着");
  else if (temp < 20) tips.push("薄手の羽織");
  else tips.push("通気性の良い服");

  if (precipitation > 0.5) tips.push("折りたたみ傘");
  if (uv >= 4) tips.push("日焼け止め");
  return `おすすめ: ${tips.join("・")}`;
}

function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 35.6812, lon: 139.7671 });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: 35.6812, lon: 139.7671 }),
      { timeout: 5000 },
    );
  });
}

function calculateDailyScore() {
  let score = 45;
  score += Math.min(30, state.streak * 10);
  score += Math.min(25, Math.floor(state.points / 100));
  if (state.roomState === "messy") score = Math.max(20, score - 20);
  return score;
}

function toItemLabel(itemId) {
  const labels = {
    desk: "机",
    chair: "椅子",
    cushion: "クッション",
    closet: "クローゼット",
    clock: "時計",
    plant: "観葉植物",
    lamp: "ランプ",
    bookshelf: "本棚",
    carpet: "カーペット",
    poster: "ポスター",
    whiteboard: "ホワイトボード",
    humidifier: "加湿器",
    speaker: "スピーカー",
    "bedside-table": "サイドテーブル",
    "storage-box": "収納ボックス",
  };
  return labels[itemId] || itemId;
}

function renderRoomScene(ownedItems) {
  const scene = document.createElement("div");
  scene.className = "room-scene";

  const wall = document.createElement("div");
  wall.className = "room-wall";

  const floor = document.createElement("div");
  floor.className = "room-floor";

  const groupedItems = [
    { id: "clock", zone: "wall-left" },
    { id: "poster", zone: "wall-center" },
    { id: "whiteboard", zone: "wall-right" },
    { id: "closet", zone: "floor-left" },
    { id: "plant", zone: "floor-front-left" },
    { id: "bookshelf", zone: "floor-left-mid" },
    { id: "lamp", zone: "floor-back-left" },
    { id: "desk", zone: "floor-center" },
    { id: "chair", zone: "floor-front-center" },
    { id: "cushion", zone: "floor-front-right" },
    { id: "speaker", zone: "floor-back-right" },
    { id: "carpet", zone: "floor-carpet" },
    { id: "humidifier", zone: "floor-right-mid" },
    { id: "bedside-table", zone: "floor-right" },
    { id: "storage-box", zone: "floor-right-back" },
  ];

  groupedItems.forEach((entry) => {
    const parent = entry.zone.startsWith("wall") ? wall : floor;
    appendRoomItem(parent, entry.id, ownedItems, entry.zone);
  });

  scene.appendChild(wall);
  scene.appendChild(floor);
  return scene;
}

function appendRoomItem(parent, itemId, ownedItems, zone = "") {
  if (!ownedItems.includes(itemId)) return;
  const item = document.createElement("div");
  item.className = `room-item room-item-${itemId} ${zone}`.trim();
  item.title = toItemLabel(itemId);
  const itemName = document.createElement("span");
  itemName.className = "room-item-name";
  itemName.textContent = toItemLabel(itemId);
  item.appendChild(itemName);
  parent.appendChild(item);
}

function calculateRoomCompletion(ownedItems) {
  const totalItems = REQUIRED_ITEMS.length + SHOP_ITEMS.length;
  return Math.round((ownedItems.length / totalItems) * 100);
}

function loadState() {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    parsed = null;
  }
  const initial = { ...DEFAULT_STATE, ...(parsed || {}) };
  REQUIRED_ITEMS.forEach((item) => {
    if (!initial.ownedItems.includes(item)) initial.ownedItems.push(item);
  });
  return initial;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage容量超過時は保存をスキップし、実行を継続する
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // サービスワーカーの登録失敗時もアプリ利用は継続する
    });
  });
}
