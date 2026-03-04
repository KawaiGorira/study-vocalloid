const STORAGE_KEY = "stem-reference-studio-v1";
const PAGE_SIZE = 50;

let state = loadState();
let page = 1;
let selectedSongId = null;
let activeAudio = null;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const el = {
  songForm: document.getElementById("song-form"),
  songTitle: document.getElementById("song-title"),
  songArtist: document.getElementById("song-artist"),
  songBpm: document.getElementById("song-bpm"),
  songSearch: document.getElementById("song-search"),
  songList: document.getElementById("song-list"),
  prevPage: document.getElementById("prev-page"),
  nextPage: document.getElementById("next-page"),
  pageIndicator: document.getElementById("page-indicator"),
  detailEmpty: document.getElementById("song-detail-empty"),
  detail: document.getElementById("song-detail"),
  markerForm: document.getElementById("marker-form"),
  markerName: document.getElementById("marker-name"),
  markerStart: document.getElementById("marker-start"),
  markerEnd: document.getElementById("marker-end"),
  markerList: document.getElementById("marker-list"),
  trackForm: document.getElementById("track-form"),
  trackName: document.getElementById("track-name"),
  trackNote: document.getElementById("track-note"),
  trackFile: document.getElementById("track-file"),
  trackList: document.getElementById("track-list"),
  detailBpm: document.getElementById("detail-bpm"),
  songNote: document.getElementById("song-note"),
  saveSongMeta: document.getElementById("save-song-meta"),
  chordInput: document.getElementById("chord-input"),
  saveChords: document.getElementById("save-chords"),
  playBtn: document.getElementById("play-btn"),
  stopBtn: document.getElementById("stop-btn"),
  playStatus: document.getElementById("play-status"),
  searchKeyword: document.getElementById("search-keyword"),
  searchChord: document.getElementById("search-chord"),
  searchBpmMin: document.getElementById("search-bpm-min"),
  searchBpmMax: document.getElementById("search-bpm-max"),
  runSearch: document.getElementById("run-search"),
  searchResult: document.getElementById("search-result"),
  statsBox: document.getElementById("stats-box"),
};

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { songs: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { songs: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function getSong() {
  return state.songs.find((s) => s.id === selectedSongId);
}

function parseChords(raw) {
  return raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((pair) => {
      const [bar, chord] = pair.split(":");
      return { bar: Number(bar), chord };
    })
    .filter((x) => Number.isFinite(x.bar) && x.chord);
}

function renderSongs() {
  const q = el.songSearch.value.trim().toLowerCase();
  const filtered = state.songs.filter((s) => (`${s.title} ${s.artist}`).toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.min(page, pages);
  const start = (page - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  el.songList.innerHTML = visible
    .map(
      (s) => `
      <div class="song-item ${s.id === selectedSongId ? "active" : ""}" data-id="${s.id}">
        <div><b>${s.title}</b></div>
        <div class="song-meta">${s.artist} | BPM ${s.bpm} | tracks ${s.tracks.length}</div>
      </div>`
    )
    .join("");

  el.pageIndicator.textContent = `${page} / ${pages} (${filtered.length}曲)`;

  el.songList.querySelectorAll(".song-item").forEach((item) => {
    item.onclick = () => {
      selectedSongId = item.dataset.id;
      renderAll();
    };
  });
}

function renderDetail() {
  const song = getSong();
  if (!song) {
    el.detail.classList.add("hidden");
    el.detailEmpty.classList.remove("hidden");
    return;
  }
  el.detail.classList.remove("hidden");
  el.detailEmpty.classList.add("hidden");

  el.detailBpm.value = song.bpm;
  el.songNote.value = song.notes || "";
  el.chordInput.value = song.chords.map((c) => `${c.bar}:${c.chord}`).join(" ");

  el.markerList.innerHTML = song.markers
    .map(
      (m) =>
        `<li>${m.name} [${m.start}-${m.end}] <button data-mid="${m.id}">削除</button></li>`
    )
    .join("");

  el.markerList.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      song.markers = song.markers.filter((m) => m.id !== btn.dataset.mid);
      saveState();
      renderAll();
    };
  });

  el.trackList.innerHTML = song.tracks
    .map(
      (t) => `
      <div class="track-row">
        <div><b>${t.name}</b> - ${t.note || "(メモなし)"}</div>
        <div class="song-meta">${t.fileName || "ファイル未添付"}</div>
        <canvas class="wave" id="wave-${t.id}" width="500" height="48"></canvas>
      </div>`
    )
    .join("");

  song.tracks.forEach((t) => drawWavePlaceholder(`wave-${t.id}`, t.waveData));
}

function drawWavePlaceholder(id, waveData = null) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#11162a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#67b0ff";
  ctx.beginPath();
  const mid = canvas.height / 2;

  const data = waveData || Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 0.5 + Math.random() * 0.15);
  const step = canvas.width / data.length;
  data.forEach((v, i) => {
    const x = i * step;
    const y = mid - v * mid;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderStats() {
  const chordCount = new Map();
  const bpmList = [];

  state.songs.forEach((s) => {
    bpmList.push(Number(s.bpm));
    s.chords.forEach((c) => chordCount.set(c.chord, (chordCount.get(c.chord) || 0) + 1));
  });

  const top = [...chordCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const avgBpm = bpmList.length ? (bpmList.reduce((a, b) => a + b, 0) / bpmList.length).toFixed(1) : "-";
  el.statsBox.innerHTML = `
    <p>登録曲数: <b>${state.songs.length}</b> / 1000</p>
    <p>平均BPM: <b>${avgBpm}</b></p>
    <p>頻出コード: ${top.map(([c, n]) => `${c}(${n})`).join(", ") || "なし"}</p>
  `;
}

function runSearch() {
  const keyword = el.searchKeyword.value.trim().toLowerCase();
  const chord = el.searchChord.value.trim();
  const min = Number(el.searchBpmMin.value || 0);
  const max = Number(el.searchBpmMax.value || 999);

  const result = state.songs.filter((s) => {
    const text = `${s.title} ${s.artist} ${s.notes} ${s.tracks.map((t) => t.note).join(" ")}`.toLowerCase();
    const keywordOk = !keyword || text.includes(keyword);
    const bpmOk = Number(s.bpm) >= min && Number(s.bpm) <= max;
    const chordOk = !chord || s.chords.some((c) => c.chord === chord);
    return keywordOk && bpmOk && chordOk;
  });

  el.searchResult.innerHTML = result
    .map((s) => `<li><b>${s.title}</b> / ${s.artist} / BPM ${s.bpm}</li>`)
    .join("");
}

async function extractWaveData(file) {
  if (!file) return null;
  const arr = await file.arrayBuffer();
  const buf = await audioCtx.decodeAudioData(arr.slice(0));
  const ch = buf.getChannelData(0);
  const points = 120;
  const block = Math.floor(ch.length / points);
  const out = [];
  for (let i = 0; i < points; i++) {
    let sum = 0;
    const start = i * block;
    const end = Math.min(ch.length, start + block);
    for (let j = start; j < end; j++) sum += Math.abs(ch[j]);
    out.push(end > start ? sum / (end - start) : 0);
  }
  return out;
}

function renderAll() {
  renderSongs();
  renderDetail();
  renderStats();
}

el.songForm.onsubmit = (e) => {
  e.preventDefault();
  if (state.songs.length >= 1000) return alert("1000曲までです");
  const song = {
    id: uid(),
    title: el.songTitle.value.trim(),
    artist: el.songArtist.value.trim(),
    bpm: Number(el.songBpm.value),
    notes: "",
    tracks: [],
    markers: [],
    chords: [],
  };
  state.songs.unshift(song);
  selectedSongId = song.id;
  saveState();
  el.songForm.reset();
  renderAll();
};

el.songSearch.oninput = () => {
  page = 1;
  renderSongs();
};

el.prevPage.onclick = () => {
  page = Math.max(1, page - 1);
  renderSongs();
};
el.nextPage.onclick = () => {
  page += 1;
  renderSongs();
};

el.markerForm.onsubmit = (e) => {
  e.preventDefault();
  const song = getSong();
  if (!song) return;
  song.markers.push({
    id: uid(),
    name: el.markerName.value,
    start: Number(el.markerStart.value),
    end: Number(el.markerEnd.value),
  });
  saveState();
  el.markerForm.reset();
  renderDetail();
};

el.trackForm.onsubmit = async (e) => {
  e.preventDefault();
  const song = getSong();
  if (!song) return;
  const file = el.trackFile.files[0];
  const waveData = await extractWaveData(file);
  const track = {
    id: uid(),
    name: el.trackName.value,
    note: el.trackNote.value,
    fileName: file ? file.name : "",
    waveData,
  };
  song.tracks.push(track);
  if (file) {
    activeAudio = new Audio(URL.createObjectURL(file));
    activeAudio.loop = false;
    el.playStatus.textContent = `再生対象: ${track.name}`;
  }
  saveState();
  el.trackForm.reset();
  renderDetail();
  renderSongs();
};

el.saveSongMeta.onclick = () => {
  const song = getSong();
  if (!song) return;
  song.bpm = Number(el.detailBpm.value);
  song.notes = el.songNote.value;
  saveState();
  renderAll();
};

el.saveChords.onclick = () => {
  const song = getSong();
  if (!song) return;
  song.chords = parseChords(el.chordInput.value);
  saveState();
  renderStats();
};

el.playBtn.onclick = async () => {
  if (!activeAudio) return;
  await audioCtx.resume();
  activeAudio.play();
  el.playStatus.textContent = "再生中";
};

el.stopBtn.onclick = () => {
  if (!activeAudio) return;
  activeAudio.pause();
  activeAudio.currentTime = 0;
  el.playStatus.textContent = "停止中";
};

el.runSearch.onclick = runSearch;

renderAll();
