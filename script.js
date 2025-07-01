const canvas = document.getElementById('vizCanvas');
const ctx = canvas.getContext('2d');
const audio = document.getElementById('audio');
const input = document.getElementById('audioFile');
const recordBtn = document.getElementById('recordBtn');
const downloadLink = document.getElementById('downloadLink');
const spectrumType = document.getElementById('spectrumType');

let analyser, dataArray, audioCtx, source;
let drawLoop, recorder, chunks = [];
let isRecording = false;

const stars = [];
const STAR_COUNT = 120;
let angleShift = 0;

function initStars() {
    stars.length = 0;
    for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            baseR: Math.random() * 2.5 + 0.6,
            speed: Math.random() * 0.3 + 0.1,
            twinkle: Math.random() * Math.PI * 2
        });
    }
}

function drawStars(audioEnergy) {
    for (let star of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(Date.now() * 0.002 + star.twinkle);
        const dynamicSize = star.baseR * (1 + audioEnergy * 0.006);

        ctx.save();
        ctx.beginPath();
        ctx.globalAlpha = twinkle;
        ctx.arc(star.x, star.y, dynamicSize, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "#fff";
        ctx.shadowBlur = 12 + audioEnergy * 0.2;
        ctx.fill();
        ctx.restore();

        star.x += Math.sin(star.twinkle + Date.now() * 0.001) * 0.2;
        star.y += star.speed * (1 + audioEnergy * 0.005);

        if (star.y > canvas.height) star.y = 0;
        if (star.x < 0) star.x = canvas.width;
        if (star.x > canvas.width) star.x = 0;
    }
}

function getBassEnergy(dataArray) {
    const bassBins = Math.floor(dataArray.length * 0.1);
    return dataArray.slice(0, bassBins).reduce((a, b) => a + b, 0) / bassBins;
}

// === Visualizer Modes ===

function drawCircularBars(cx, cy, radius, bars, dataArray, audioEnergy) {
    angleShift += 0.005;
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * 90;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(len, 0);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2 + val / 100;
        ctx.shadowBlur = 10 + val / 24;
        ctx.shadowColor = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();
    }
}

function drawLinearBars(cx, cy, width, height, bars, dataArray) {
    const barWidth = width / bars;
    for (let i = 0; i < bars; i++) {
        const val = dataArray[i % dataArray.length];
        const barHeight = (val / 255) * height;
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - width / 2 + i * barWidth, cy + height / 2 - barHeight, barWidth * 0.8, barHeight);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 10 + val / 24;
        ctx.shadowColor = "#fff";
        ctx.fill();
        ctx.restore();
    }
}

function drawWaveform(cx, cy, width, height, dataArray) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
        const x = cx - width / 2 + (i / dataArray.length) * width;
        const y = cy + ((dataArray[i] - 128) / 128) * (height / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#fff";
    ctx.globalAlpha = 0.9;
    ctx.stroke();
    ctx.restore();
}

function drawRadialLines(cx, cy, radius, bars, dataArray) {
    angleShift += 0.005;
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * 120;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(len, 0);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5 + val / 180;
        ctx.shadowBlur = 8 + val / 32;
        ctx.shadowColor = "#fff";
        ctx.globalAlpha = 0.7;
        ctx.stroke();
        ctx.restore();
    }
}

function drawDotOrbit(cx, cy, radius, bars, dataArray) {
    angleShift += 0.005;
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 2 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * 80;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len, 4 + val / 90, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.85;
        ctx.shadowBlur = 8 + val / 24;
        ctx.shadowColor = "#fff";
        ctx.fill();
        ctx.restore();
    }
}

function drawSpiral(cx, cy, radius, bars, dataArray) {
    angleShift += 0.005;
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < bars; i++) {
        const angle = (i / bars) * Math.PI * 6 + angleShift;
        const val = dataArray[i % dataArray.length];
        const len = radius + (val / 255) * 60 + i * 2;
        const x = cx + Math.cos(angle) * len;
        const y = cy + Math.sin(angle) * len;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 16;
    ctx.shadowColor = "#fff";
    ctx.globalAlpha = 0.8;
    ctx.stroke();
    ctx.restore();
}

function drawMirrorBars(cx, cy, width, height, bars, dataArray) {
    const barWidth = width / bars;
    for (let i = 0; i < bars; i++) {
        const val = dataArray[i % dataArray.length];
        const barHeight = (val / 255) * (height / 2);
        ctx.save();
        ctx.beginPath();
        ctx.rect(cx - width / 2 + i * barWidth, cy - barHeight, barWidth * 0.8, barHeight);
        ctx.rect(cx - width / 2 + i * barWidth, cy, barWidth * 0.8, barHeight);
        ctx.fillStyle = "#fff";
        ctx.globalAlpha = 0.8;
        ctx.shadowBlur = 10 + val / 24;
        ctx.shadowColor = "#fff";
        ctx.fill();
        ctx.restore();
    }
}

function draw() {
    drawLoop = requestAnimationFrame(draw);
    if (!analyser) return;

    if (spectrumType.value === "waveform") {
        analyser.getByteTimeDomainData(dataArray);
    } else {
        analyser.getByteFrequencyData(dataArray);
    }
    const audioEnergy = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const bassEnergy = getBassEnergy(dataArray);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = 140;
    const bars = 120;

    // Dynamic background
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, `hsl(${audioEnergy % 360}, 60%, 10%)`);
    bgGradient.addColorStop(1, `hsl(${(audioEnergy + 120) % 360}, 70%, 8%)`);
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawStars(audioEnergy);

    switch (spectrumType.value) {
        case "circular":
            drawCircularBars(cx, cy, radius, bars, dataArray, audioEnergy);
            break;
        case "linear":
            drawLinearBars(cx, cy, 900, 320, bars, dataArray);
            break;
        case "waveform":
            drawWaveform(cx, cy, 1100, 320, dataArray);
            break;
        case "radial":
            drawRadialLines(cx, cy, radius, bars, dataArray);
            break;
        case "dot":
            drawDotOrbit(cx, cy, radius, bars, dataArray);
            break;
        case "spiral":
            drawSpiral(cx, cy, radius, bars, dataArray);
            break;
        case "mirror":
            drawMirrorBars(cx, cy, 900, 320, bars, dataArray);
            break;
        default:
            drawCircularBars(cx, cy, radius, bars, dataArray, audioEnergy);
    }

    // Inner circle (for circular/radial/dot/spiral)
    if (
        ["circular", "radial", "dot", "spiral"].includes(spectrumType.value)
    ) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.beginPath();
        ctx.arc(0, 0, radius - 25, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#fff";
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.restore();
    }

    // Center Text
    ctx.save();
    ctx.translate(cx, cy);
    const fontSize = 24 + bassEnergy * 0.08;
    ctx.font = `bold ${fontSize}px Orbitron, Arial`;
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "#fff";
    ctx.shadowBlur = 24 + bassEnergy * 0.15;
    ctx.textAlign = "center";
    ctx.fillText("DHANUSH", 0, 10);
    ctx.restore();
}

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
    downloadLink.classList.add("hidden");
    audio.currentTime = 0;
    audio.pause();

    if (!drawLoop) draw();
};

recordBtn.onclick = () => {
    if (isRecording) {
        stopRecording();
    } else {
        if (!audio.src) return;
        audio.currentTime = 0;
        audio.play();
        startRecording();
    }
};

function startRecording() {
    chunks = [];
    const stream = canvas.captureStream(60);
    const audioStream = audioCtx.createMediaStreamDestination();
    source.connect(audioStream);
    const combined = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioStream.stream.getAudioTracks()
    ]);

    recorder = new MediaRecorder(combined, { mimeType: "video/webm" });
    recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.textContent = "Download Recording";
        downloadLink.classList.remove("hidden");
        downloadLink.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    recorder.start();
    isRecording = true;
    recordBtn.textContent = "Stop Recording";
    audio.onended = () => isRecording && stopRecording();
}

function stopRecording() {
    if (recorder && recorder.state === "recording") recorder.stop();
    isRecording = false;
    recordBtn.textContent = "Start Recording";
    audio.onended = null;
}

function resizeCanvasTo16by9() {
    const wrapper = document.getElementById('vizWrapper');
    const rect = wrapper.getBoundingClientRect();
    canvas.width = 1920;
    canvas.height = 1080;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    initStars();
}

window.addEventListener('resize', resizeCanvasTo16by9);
resizeCanvasTo16by9();

spectrumType.addEventListener('change', () => {
    // Redraw immediately on mode change
    if (drawLoop) {
        cancelAnimationFrame(drawLoop);
        drawLoop = null;
    }
    draw();
});
