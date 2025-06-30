
const canvas = document.getElementById('vizCanvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');
const input = document.getElementById('audioFile');
const recordBtn = document.getElementById('recordBtn');
const downloadLink = document.getElementById('downloadLink');
const spectrumType = document.getElementById('spectrumType');

let analyser, dataArray, audioCtx, source;
let angleShift = 0, drawLoop;
let recorder, chunks = [];
let spectrum = 'circular';

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', resizeCanvas);

spectrumType.onchange = () => {
    spectrum = spectrumType.value;
};

input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    audio.src = URL.createObjectURL(file);
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    recordBtn.disabled = false;
    audio.play();
    if (!drawLoop) draw();
};

function draw() {
    drawLoop = requestAnimationFrame(draw);
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);

    const cx = canvas.width / 2, cy = canvas.height / 2;
    const minDim = Math.min(canvas.width, canvas.height);
    const radius = minDim * 0.145 + Math.sin(Date.now() / 400) * 4 * devicePixelRatio;
    const energy = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

    // No glow
    document.getElementById("vizWrapper").style.boxShadow = "none";

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Cinematic vignette
    let grad = ctx.createRadialGradient(cx, cy, minDim * 0.2, cx, cy, minDim * 0.5);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle scanline effect
    ctx.save();
    ctx.globalAlpha = 0.07;
    for (let y = 0; y < canvas.height; y += 6 * devicePixelRatio) {
        ctx.fillStyle = "#0ff";
        ctx.fillRect(0, y, canvas.width, 2 * devicePixelRatio);
    }
    ctx.restore();

    switch (spectrum) {
        case 'circular':
            drawCircularBars(cx, cy, minDim, radius, energy);
            break;
        case 'linear':
            drawLinearBars(cx, cy, minDim, energy);
            break;
        case 'waveform':
            drawWaveform(cx, cy, minDim, energy);
            break;
        case 'radial':
            drawRadialLines(cx, cy, minDim, radius, energy);
            break;
        case 'dot':
            drawDotOrbit(cx, cy, minDim, radius, energy);
            break;
        case 'spiral':
            drawSpiral(cx, cy, minDim, radius, energy);
            break;
        case 'mirror':
            drawMirrorBars(cx, cy, minDim, energy);
            break;
    }

    // Outer Ring (for most types)
    if (['circular', 'radial', 'dot', 'spiral'].includes(spectrum)) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, radius + 32 * devicePixelRatio, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,215,0,0.22)";
        ctx.lineWidth = 32 * devicePixelRatio + energy / 18;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
    }

    // Logo Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-angleShift);
    ctx.font = `bold ${Math.round(minDim * 0.045)}px Orbitron, Montserrat, sans-serif`;
    ctx.fillStyle = "#ffd700";
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.textAlign = "center";
    ctx.fillText("DHANUSH", 0, minDim * 0.03);
    ctx.restore();

    angleShift += 0.006 + energy / 60000;
}

// --- Spectrum Drawing Functions ---

function drawCircularBars(cx, cy, minDim, radius, energy) {
    const bars = Math.max(120, Math.floor(minDim / 10));
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * (minDim * 0.13);
        const barHue = (angle * 180 / Math.PI + Date.now() / 18) % 360;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(len, 0);
        ctx.strokeStyle = `hsl(${barHue}, 100%, ${68 + val / 7}%)`;
        ctx.lineWidth = 5.5 * devicePixelRatio + val / 90;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
    }
}

function drawLinearBars(cx, cy, minDim, energy) {
    const bars = Math.max(120, Math.floor(minDim / 10));
    const barWidth = canvas.width / bars;
    for (let i = 0; i < bars; i++) {
        const val = dataArray[i % dataArray.length];
        const barHeight = (val / 255) * (canvas.height * 0.6);
        const barHue = (i * 360 / bars + Date.now() / 18) % 360;
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * barWidth, canvas.height - barHeight, barWidth * 0.7, barHeight);
        ctx.fillStyle = `hsl(${barHue}, 100%, ${68 + val / 7}%)`;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
    }
}

function drawWaveform(cx, cy, minDim, energy) {
    analyser.getByteTimeDomainData(dataArray);
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
        const x = (i / dataArray.length) * canvas.width;
        const y = cy + ((dataArray[i] - 128) / 128) * (canvas.height * 0.32);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsl(${(Date.now() / 8) % 360}, 100%, 80%)`;
    ctx.lineWidth = 8 * devicePixelRatio;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
}

function drawRadialLines(cx, cy, minDim, radius, energy) {
    const lines = Math.max(120, Math.floor(minDim / 10));
    for (let i = 0; i < lines; i++) {
        const angle = (i / lines) * Math.PI * 2 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * (minDim * 0.28);
        const barHue = (angle * 180 / Math.PI + Date.now() / 18) % 360;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, 0);
        ctx.strokeStyle = `hsl(${barHue}, 100%, ${60 + val / 7}%)`;
        ctx.lineWidth = 4.5 * devicePixelRatio + val / 120;
        ctx.shadowBlur = 0;
        ctx.stroke();
        ctx.restore();
    }
}

function drawDotOrbit(cx, cy, minDim, radius, energy) {
    const dots = Math.max(90, Math.floor(minDim / 16));
    for (let i = 0; i < dots; i++) {
        const angle = (i / dots) * Math.PI * 2 + angleShift * 1.5;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * (minDim * 0.18);
        const dotHue = (angle * 180 / Math.PI + Date.now() / 12) % 360;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 16 * devicePixelRatio + val / 18, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${dotHue}, 100%, ${75 + val / 7}%)`;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
    }
}

function drawSpiral(cx, cy, minDim, radius, energy) {
    const points = Math.max(200, Math.floor(minDim / 4));
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
        const t = i / points * 6 * Math.PI + angleShift * 2;
        const val = dataArray[i % dataArray.length];
        const r = radius + (val / 255) * (minDim * 0.28) + i * (minDim * 0.0015);
        const x = cx + Math.cos(t) * r;
        const y = cy + Math.sin(t) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `hsl(${(Date.now() / 4) % 360}, 100%, 85%)`;
    ctx.lineWidth = 12 * devicePixelRatio;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
}

function drawMirrorBars(cx, cy, minDim, energy) {
    const bars = Math.max(120, Math.floor(minDim / 10));
    const barWidth = canvas.width / bars;
    for (let i = 0; i < bars; i++) {
        const val = dataArray[i % dataArray.length];
        const barHeight = (val / 255) * (canvas.height * 0.32);
        const barHue = (i * 360 / bars + Date.now() / 18) % 360;
        // Top
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * barWidth, cy - barHeight, barWidth * 0.7, barHeight);
        ctx.fillStyle = `hsl(${barHue}, 100%, ${68 + val / 7}%)`;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
        // Bottom (mirror)
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * barWidth, cy, barWidth * 0.7, barHeight);
        ctx.fillStyle = `hsl(${(barHue + 180) % 360}, 100%, ${60 + val / 9}%)`;
        ctx.globalAlpha = 0.7;
        ctx.shadowBlur = 0;
        ctx.fill();
        ctx.restore();
    }
}

// --- Recording ---
recordBtn.onclick = () => {
    if (recorder && recorder.state === "recording") {
        recorder.stop();
        recordBtn.textContent = "Start Recording";
        return;
    }
    chunks = [];
    const stream = canvas.captureStream(60);
    const audioStream = audioCtx.createMediaStreamDestination();
    source.connect(audioStream);
    const combined = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioStream.stream.getAudioTracks()
    ]);
    recorder = new MediaRecorder(combined, { mimeType: "video/webm" });
    recorder.ondataavailable = e => chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.classList.remove("hidden");
    };
    recorder.start();
    recordBtn.textContent = "Stop Recording";
};
