// Oct 11, 2026, 00:00:00 IST
const UNLOCK_TIME = new Date('2026-10-11T00:00:00+05:30').getTime();

// ---- Watch config ----
// Paste any YouTube URL here (regular, short, or embed)
const YOUTUBE_URL = 'https://www.youtube.com/watch?v=OmgUdGqmbpg';

let suggestions = [];
let getNextSuggestion;


// ---- Init ----

async function init() {
  // already authenticated? skip lock screen, go to home
  if (Date.now() >= UNLOCK_TIME && isAuthed()) {
    showScreen('home-screen', false);
    history.replaceState({ screen: 'home-screen' }, '', '');
    return;
  }

  // past unlock time but not authenticated: show password gate
  if (Date.now() >= UNLOCK_TIME) {
    showPasswordGate();
    return;
  }

  // before unlock time: show countdown
  try {
    const res = await fetch('data/suggestions.json');
    suggestions = await res.json();
  } catch {
    suggestions = ['look pretty', 'eat good food', 'send arth a picture'];
  }

  getNextSuggestion = createSmartShuffle(suggestions);

  updateCountdown();
  setInterval(updateCountdown, 1000);

  document.getElementById('suggestion').textContent = getNextSuggestion();
  setInterval(rotateSuggestion, 2000);
}

function isAuthed() {
  try { return localStorage.getItem('naan-auth') === '1'; }
  catch { return false; }
}

function setAuthed() {
  try { localStorage.setItem('naan-auth', '1'); }
  catch { /* private browsing, no-op */ }
}


// ---- Countdown ----

function updateCountdown() {
  const diff = UNLOCK_TIME - Date.now();

  if (diff <= 0) {
    showPasswordGate();
    return;
  }

  const totalSec = Math.floor(diff / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  const pad = n => String(n).padStart(2, '0');
  document.getElementById('countdown').textContent =
    pad(h) + ':' + pad(m) + ':' + pad(s);
}


// ---- Smart Shuffle ----

function createSmartShuffle(items) {
  let queue = [];
  const recent = [];
  const BUFFER = 3;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function refill() {
    queue = shuffle(items);
    for (let i = 0; i < Math.min(BUFFER, queue.length); i++) {
      if (recent.includes(queue[i])) {
        for (let j = BUFFER; j < queue.length; j++) {
          if (!recent.includes(queue[j])) {
            [queue[i], queue[j]] = [queue[j], queue[i]];
            break;
          }
        }
      }
    }
  }

  return function () {
    if (!queue.length) refill();
    const item = queue.shift();
    recent.push(item);
    if (recent.length > BUFFER) recent.shift();
    return item;
  };
}


// ---- Rolling Suggestions ----

function rotateSuggestion() {
  const el = document.getElementById('suggestion');
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = getNextSuggestion();
    el.style.opacity = '1';
  }, 250);
}


// ---- Password Gate ----

function showPasswordGate() {
  document.getElementById('countdown-content').style.display = 'none';
  document.getElementById('password-content').style.display = 'block';

  const input = document.getElementById('password-input');
  const btn = document.getElementById('password-submit');

  btn.addEventListener('click', checkPassword);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') checkPassword();
  });

  input.focus();
}

function checkPassword() {
  const input = document.getElementById('password-input');
  const val = input.value.trim().toLowerCase();

  if (val === 'naaniversary') {
    setAuthed();
    showScreen('home-screen');
  } else {
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
  }
}


// ---- Navigation ----

function showScreen(id, pushHistory) {
  document.querySelectorAll('.screen').forEach(function (s) {
    s.style.display = 'none';
  });
  document.getElementById(id).style.display = 'flex';

  // scroll gallery back to top when entering
  if (id === 'gallery-screen') {
    var gs = document.querySelector('.gallery-scroll');
    if (gs) gs.scrollTop = 0;
  }

  // push browser history so back button navigates within the app
  if (pushHistory !== false && id !== 'lock-screen') {
    history.pushState({ screen: id }, '', '');
  }
}

// browser back button: go to home instead of leaving the site
window.addEventListener('popstate', function () {
  // show home without pushing state (to avoid loop)
  showScreen('home-screen', false);
  // re-push so the next back press also stays in the app
  history.pushState({ screen: 'home-screen' }, '', '');
});

// home buttons -> sections
document.addEventListener('click', function (e) {
  var btn = e.target.closest('[data-section]');
  if (!btn) return;
  var section = btn.dataset.section;

  if (section === 'read') {
    showScreen('read-screen');
    resetRead();
  } else if (section === 'watch') {
    window.location.href = YOUTUBE_URL;
  } else if (section === 'play') {
    playSource = 'home';
    playIndex = 0;
    showScreen('play-screen');
    if (!playData.length) loadPlay();
    else renderPlay();
  }
});


// ---- Play Section ----

var playData = [];
var playIndex = 0;
var playRevealed = false;
var playSource = 'home'; // 'home' or 'gallery'
var playWired = false;

async function loadPlay() {
  try {
    var res = await fetch('data/play.json');
    playData = await res.json();
  } catch {
    playData = [];
  }
  playIndex = 0;
  renderPlay();
  if (!playWired) wirePlay();
}

function wirePlay() {
  playWired = true;

  document.getElementById('play-back').addEventListener('click', function () {
    if (playSource === 'gallery') {
      showScreen('gallery-screen');
    } else {
      showScreen('home-screen');
    }
  });

  document.getElementById('play-reveal').addEventListener('click', function () {
    if (playRevealed) return;
    playRevealed = true;
    this.style.display = 'none';
    var answer = document.getElementById('play-answer');
    answer.textContent = playData[playIndex].answer;
    answer.classList.add('visible');
  });

  document.getElementById('play-prev').addEventListener('click', function () {
    if (playIndex > 0) {
      playIndex--;
      renderPlay();
    }
  });

  document.getElementById('play-next').addEventListener('click', function () {
    if (playIndex < playData.length - 1) {
      playIndex++;
      renderPlay();
    }
  });

  document.getElementById('play-view-gallery').addEventListener('click', function () {
    showScreen('gallery-screen');
    renderGallery();
  });

  document.getElementById('play-restart').addEventListener('click', function () {
    playSource = 'home';
    playIndex = 0;
    renderPlay();
  });

  document.getElementById('play-gallery-btn').addEventListener('click', function () {
    showScreen('gallery-screen');
    renderGallery();
  });
}

function renderPlay() {
  if (!playData.length) return;
  var item = playData[playIndex];
  var isLast = playIndex === playData.length - 1;
  var fromGallery = playSource === 'gallery';

  document.getElementById('play-image').src = item.image;
  document.getElementById('play-hint').textContent = item.hint;
  document.getElementById('play-counter').textContent =
    (playIndex + 1) + ' / ' + playData.length;

  // reset reveal
  playRevealed = false;
  var revealBtn = document.getElementById('play-reveal');
  var answer = document.getElementById('play-answer');
  revealBtn.style.display = '';
  answer.textContent = '';
  answer.classList.remove('visible');

  // nav buttons
  var navArrows = document.getElementById('play-nav-arrows');
  var navEnd = document.getElementById('play-nav-end');

  if (fromGallery) {
    // single card from gallery: no prev/next, no end buttons
    navArrows.style.display = 'none';
    navEnd.style.display = 'none';
  } else if (isLast) {
    // last card: show gallery + play again
    navArrows.style.display = 'none';
    navEnd.style.display = 'flex';
  } else {
    // normal: show prev/next
    navArrows.style.display = 'flex';
    navEnd.style.display = 'none';
    document.getElementById('play-prev').style.opacity = playIndex === 0 ? '0.35' : '1';
    document.getElementById('play-prev').style.pointerEvents = playIndex === 0 ? 'none' : 'auto';
  }
}


// ---- Gallery ----

var galleryWired = false;

function renderGallery() {
  if (!playData.length) return;

  var grid = document.getElementById('gallery-grid');
  grid.innerHTML = '';

  // create column containers for true masonry that actually scrolls
  var numCols = window.innerWidth >= 768 ? 3 : 2;
  var cols = [];
  for (var c = 0; c < numCols; c++) {
    var col = document.createElement('div');
    col.className = 'gallery-col';
    grid.appendChild(col);
    cols.push(col);
  }

  // distribute images round-robin across columns
  playData.forEach(function (item, i) {
    var img = document.createElement('img');
    img.src = item.image;
    img.alt = '';
    img.className = 'gallery-item';
    img.draggable = false;
    img.addEventListener('click', function () {
      playSource = 'gallery';
      playIndex = i;
      showScreen('play-screen');
      renderPlay();
    });
    cols[i % numCols].appendChild(img);
  });

  if (!galleryWired) wireGallery();
}

function wireGallery() {
  galleryWired = true;

  document.getElementById('gallery-back').addEventListener('click', function () {
    showScreen('home-screen');
  });

  document.getElementById('gallery-play-again').addEventListener('click', function () {
    playSource = 'home';
    playIndex = 0;
    showScreen('play-screen');
    renderPlay();
  });
}


// ---- Read Section ----

var readProgress = 0;       // 0 = image 1, 0.5 = image 2, 1 = image 3
var readDragging = false;
var readStartX = 0;
var readStartProgress = 0;
var readWired = false;
var readRevealed = false;

function resetRead() {
  readProgress = 0;
  readRevealed = false;
  readDragging = false;
  updateReadImages(0);

  var hint = document.getElementById('read-hint');
  hint.classList.remove('hidden');
  hint.textContent = 'drag your finger on the flower';
  document.getElementById('read-transcription').classList.remove('visible');
  document.getElementById('read-screen').classList.remove('read-scrollable');
  document.getElementById('read-screen').scrollTop = 0;

  if (!readWired) wireRead();
}

function wireRead() {
  readWired = true;

  var area = document.getElementById('read-image-area');

  // back button
  document.getElementById('read-back').addEventListener('click', function () {
    showScreen('home-screen');
  });

  // touch events
  area.addEventListener('touchstart', function (e) {
    readDragging = true;
    readStartX = e.touches[0].clientX;
    readStartProgress = readProgress;
  }, { passive: true });

  area.addEventListener('touchmove', function (e) {
    if (!readDragging) return;
    e.preventDefault();
    var dx = e.touches[0].clientX - readStartX;
    var width = area.offsetWidth;
    // dragging left (negative dx) moves forward through images
    var delta = -dx / (width * 0.6);
    var p = readStartProgress + delta;
    p = Math.max(0, Math.min(1, p));
    readProgress = p;
    updateReadImages(p);
  }, { passive: false });

  area.addEventListener('touchend', function () {
    if (!readDragging) return;
    readDragging = false;
    snapRead();
  });

  area.addEventListener('touchcancel', function () {
    if (!readDragging) return;
    readDragging = false;
    snapRead();
  });

  // block native image drag on the area
  area.addEventListener('dragstart', function (e) { e.preventDefault(); });
  area.addEventListener('selectstart', function (e) { e.preventDefault(); });

  // mouse events (for desktop testing)
  area.addEventListener('mousedown', function (e) {
    readDragging = true;
    readStartX = e.clientX;
    readStartProgress = readProgress;
    e.preventDefault();
  });

  window.addEventListener('mousemove', function (e) {
    if (!readDragging) return;
    e.preventDefault();
    var width = area.offsetWidth;
    var dx = e.clientX - readStartX;
    var delta = -dx / (width * 0.6);
    var p = readStartProgress + delta;
    p = Math.max(0, Math.min(1, p));
    readProgress = p;
    updateReadImages(p);
  });

  window.addEventListener('mouseup', function () {
    if (!readDragging) return;
    readDragging = false;
    snapRead();
  });
}

function updateReadImages(p) {
  var img1 = document.getElementById('read-img-1');
  var img2 = document.getElementById('read-img-2');
  var img3 = document.getElementById('read-img-3');

  if (p <= 0.5) {
    // transition from image 1 to image 2
    var t = p / 0.5; // 0 to 1
    img1.style.opacity = 1 - t;
    img2.style.opacity = t;
    img3.style.opacity = 0;
  } else {
    // transition from image 2 to image 3
    var t = (p - 0.5) / 0.5; // 0 to 1
    img1.style.opacity = 0;
    img2.style.opacity = 1 - t;
    img3.style.opacity = t;
  }

  // update hint text based on position
  var hint = document.getElementById('read-hint');
  if (p > 0.3 && p < 0.98) {
    hint.textContent = 'one more time';
  } else if (p < 0.3) {
    hint.textContent = 'drag your finger on the flower from centre to left';
  }

  // hide transcription as soon as user drags away from image 3
  if (p < 0.98 && readRevealed) {
    readRevealed = false;
    hint.classList.remove('hidden');
    document.getElementById('read-transcription').classList.remove('visible');
    document.getElementById('read-screen').classList.remove('read-scrollable');
    document.getElementById('read-screen').scrollTop = 0;
  }
}

function snapRead() {
  // snap to nearest: 0, 0.5, or 1
  var target;
  if (readProgress < 0.25) {
    target = 0;
  } else if (readProgress < 0.75) {
    target = 0.5;
  } else {
    target = 1;
  }

  // animate to target
  var start = readProgress;
  var startTime = performance.now();
  var duration = 200;

  function tick(now) {
    var elapsed = now - startTime;
    var t = Math.min(elapsed / duration, 1);
    // ease out
    t = 1 - (1 - t) * (1 - t);
    readProgress = start + (target - start) * t;
    updateReadImages(readProgress);

    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      readProgress = target;
      updateReadImages(target);

      // reveal transcription when snapped to image 3 (letter open)
      if (target === 1 && !readRevealed) {
        readRevealed = true;
        var hint = document.getElementById('read-hint');
        hint.textContent = 'drag from centre to right to close';
        document.getElementById('read-transcription').classList.add('visible');
        document.getElementById('read-screen').classList.add('read-scrollable');
      }
    }
  }

  requestAnimationFrame(tick);
}


// ---- Watch Section ----

var watchWired = false;

function getEmbedUrl(url) {
  var id = '';
  // youtube.com/watch?v=ID
  var match = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (match) { id = match[1]; }
  // youtu.be/ID
  if (!id) {
    match = url.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
    if (match) id = match[1];
  }
  // already an embed URL
  if (!id) {
    match = url.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{11})/);
    if (match) id = match[1];
  }
  if (!id) return url; // fallback: use as-is
  return 'https://www.youtube.com/embed/' + id;
}

function resetWatch() {
  var iframe = document.getElementById('watch-iframe');
  iframe.src = getEmbedUrl(YOUTUBE_URL);
  if (!watchWired) wireWatch();
}

function wireWatch() {
  watchWired = true;
  document.getElementById('watch-back').addEventListener('click', function () {
    // clear iframe to stop playback when leaving
    document.getElementById('watch-iframe').src = '';
    showScreen('home-screen');
  });
}


document.addEventListener('DOMContentLoaded', init);
