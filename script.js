// ==================== NAVEGACIÓN ENTRE HERRAMIENTAS ====================
document.addEventListener('DOMContentLoaded', () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    const toolSections = document.querySelectorAll('.tool-section');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const toolId = btn.getAttribute('data-tool');

            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            toolSections.forEach(section => section.classList.remove('active'));
            document.getElementById(toolId).classList.add('active');
        });
    });

    // Inicializar drag and drop para todas las áreas de subida
    initDragAndDrop();

    initAudioCutter();
    initAudioConverter();
    initVideoExtractor();
    initPomodoro();
    initWhiteNoise();
});

// ==================== DRAG AND DROP ====================
function initDragAndDrop() {
    const uploadAreas = document.querySelectorAll('.upload-area');

    uploadAreas.forEach(area => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            area.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        ['dragenter', 'dragover'].forEach(eventName => {
            area.addEventListener(eventName, () => {
                area.classList.add('drag-over');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            area.addEventListener(eventName, () => {
                area.classList.remove('drag-over');
            }, false);
        });

        area.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            const input = area.querySelector('input[type="file"]');

            if (input && files.length > 0) {
                // Crear un nuevo DataTransfer y copiar los archivos
                const dataTransfer = new DataTransfer();
                for (let i = 0; i < files.length; i++) {
                    dataTransfer.items.add(files[i]);
                }
                input.files = dataTransfer.files;

                // Disparar el evento change
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);

                // Actualizar el label y el área visualmente
                const label = area.querySelector('label span:last-child');
                if (label) {
                    label.textContent = `${files.length} archivo(s) seleccionado(s)`;
                    label.style.color = 'var(--accent)';
                }
                area.classList.add('has-files');
            }
        }, false);
    });
}

// ==================== CORTADOR DE AUDIOS ====================
function initAudioCutter() {
    const audioFileInput = document.getElementById('audio-file');
    const cutAudioBtn = document.getElementById('cut-audio-btn');
    const segmentDurationInput = document.getElementById('segment-duration');
    const cutterInfo = document.getElementById('cutter-info');
    const cutterProgress = document.getElementById('cutter-progress');
    const uploadArea = document.getElementById('cutter-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('cutter-file-list');

    let selectedFiles = [];

    audioFileInput.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files);
        if (selectedFiles.length > 0) {
            const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
            const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

            const audioFiles = selectedFiles.filter(f => f.type.startsWith('audio/')).length;
            const videoFiles = selectedFiles.filter(f => f.type.startsWith('video/')).length;

            // Actualizar el label y área de upload
            if (uploadLabel) {
                uploadLabel.textContent = `${selectedFiles.length} archivo(s) seleccionado(s)`;
                uploadLabel.style.color = 'var(--accent)';
            }
            uploadArea.classList.add('has-files');

            cutterInfo.style.display = 'block';
            cutterInfo.className = 'info-box';
            cutterInfo.innerHTML = `
                <p><strong>${selectedFiles.length}</strong> archivo(s) seleccionado(s)</p>
                ${videoFiles > 0 ? `<p>${videoFiles} video(s) - se extraerá el audio automáticamente</p>` : ''}
                ${audioFiles > 0 ? `<p>${audioFiles} audio(s)</p>` : ''}
                <p>Tamaño total: <strong>${sizeMB} MB</strong></p>
            `;

            // Mostrar lista de archivos
            displayFileList(selectedFiles, fileList);

            cutAudioBtn.style.display = 'block';
        }
    });

    cutAudioBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        const segmentDuration = parseInt(segmentDurationInput.value) * 60; // Convertir a segundos

        cutterProgress.style.display = 'block';
        cutAudioBtn.disabled = true;

        try {
            const zip = new JSZip();

            for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex++) {
                const file = selectedFiles[fileIndex];
                const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remover extensión

                updateProgress(cutterProgress, `Procesando ${file.name}...`, (fileIndex / selectedFiles.length) * 100);

                let audioBuffer;

                // Detectar si es video y extraer audio primero
                if (file.type.startsWith('video/')) {
                    const baseProgress = (fileIndex / selectedFiles.length) * 100;
                    const audioBlob = await extractAudioFromVideo(file, (videoProgress, message) => {
                        const totalProgress = baseProgress + (videoProgress / selectedFiles.length);
                        updateProgress(cutterProgress, message, totalProgress);
                    });
                    const arrayBuffer = await audioBlob.arrayBuffer();
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                } else {
                    // Es audio, procesar directamente
                    const arrayBuffer = await file.arrayBuffer();
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                }

                const duration = audioBuffer.duration;
                const numSegments = Math.ceil(duration / segmentDuration);

                for (let i = 0; i < numSegments; i++) {
                    const startTime = i * segmentDuration;
                    const endTime = Math.min((i + 1) * segmentDuration, duration);
                    const segmentLength = endTime - startTime;

                    const segmentBuffer = audioBuffer.constructor === AudioBuffer
                        ? new AudioBuffer({
                            numberOfChannels: audioBuffer.numberOfChannels,
                            length: segmentLength * audioBuffer.sampleRate,
                            sampleRate: audioBuffer.sampleRate
                        })
                        : audioBuffer.context.createBuffer(
                            audioBuffer.numberOfChannels,
                            segmentLength * audioBuffer.sampleRate,
                            audioBuffer.sampleRate
                        );

                    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
                        const channelData = audioBuffer.getChannelData(channel);
                        const segmentData = segmentBuffer.getChannelData(channel);
                        const startSample = Math.floor(startTime * audioBuffer.sampleRate);

                        for (let j = 0; j < segmentData.length; j++) {
                            segmentData[j] = channelData[startSample + j];
                        }
                    }

                    const wavBlob = bufferToWave(segmentBuffer);
                    zip.file(`${fileName}-${i + 1}.wav`, wavBlob);

                    updateProgress(cutterProgress, `Cortando segmento ${i + 1}/${numSegments} de ${file.name}...`,
                        ((fileIndex + (i + 1) / numSegments) / selectedFiles.length) * 100);
                }
            }

            updateProgress(cutterProgress, 'Generando archivo ZIP...', 95);
            const zipBlob = await zip.generateAsync({ type: 'blob' });

            const downloadLink = document.createElement('a');
            downloadLink.href = URL.createObjectURL(zipBlob);
            downloadLink.download = `audios-cortados-${Date.now()}.zip`;
            downloadLink.click();

            updateProgress(cutterProgress, '¡Completado!', 100);

            cutterInfo.className = 'info-box success';
            cutterInfo.innerHTML = '<p><strong>Audios cortados exitosamente</strong></p><p>El archivo ZIP se ha descargado</p>';

            setTimeout(() => {
                cutterProgress.style.display = 'none';
                cutAudioBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error cortando audio:', error);
            cutterInfo.className = 'info-box error';
            cutterInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            cutterProgress.style.display = 'none';
            cutAudioBtn.disabled = false;
        }
    });
}

// ==================== CONVERTIDOR DE AUDIO ====================
function initAudioConverter() {
    const converterFileInput = document.getElementById('converter-file');
    const convertAudioBtn = document.getElementById('convert-audio-btn');
    const outputFormatSelect = document.getElementById('output-format');
    const converterInfo = document.getElementById('converter-info');
    const converterProgress = document.getElementById('converter-progress');
    const uploadArea = document.getElementById('converter-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('converter-file-list');

    let converterFiles = [];

    converterFileInput.addEventListener('change', (e) => {
        converterFiles = Array.from(e.target.files);
        if (converterFiles.length > 0) {
            const audioFiles = converterFiles.filter(f => f.type.startsWith('audio/')).length;
            const videoFiles = converterFiles.filter(f => f.type.startsWith('video/')).length;

            // Actualizar el label y área de upload
            if (uploadLabel) {
                uploadLabel.textContent = `${converterFiles.length} archivo(s) seleccionado(s)`;
                uploadLabel.style.color = 'var(--accent)';
            }
            uploadArea.classList.add('has-files');

            converterInfo.style.display = 'block';
            converterInfo.className = 'info-box';
            converterInfo.innerHTML = `
                <p><strong>${converterFiles.length}</strong> archivo(s) seleccionado(s) para convertir</p>
                ${videoFiles > 0 ? `<p>${videoFiles} video(s) - se extraerá el audio primero</p>` : ''}
                ${audioFiles > 0 ? `<p>${audioFiles} audio(s)</p>` : ''}
            `;

            // Mostrar lista de archivos
            displayFileList(converterFiles, fileList);

            convertAudioBtn.style.display = 'block';
        }
    });

    convertAudioBtn.addEventListener('click', async () => {
        if (converterFiles.length === 0) return;

        const outputFormat = outputFormatSelect.value;

        converterProgress.style.display = 'block';
        convertAudioBtn.disabled = true;

        try {
            if (converterFiles.length === 1) {
                // Un solo archivo, descarga directa
                const file = converterFiles[0];
                updateProgress(converterProgress, `Convirtiendo ${file.name}...`, 50);

                const convertedBlob = await convertAudioFormat(file, outputFormat, converterProgress);
                const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                downloadFile(convertedBlob, fileName);

                updateProgress(converterProgress, 'Conversión exitosa', 100);
                converterInfo.className = 'info-box success';
                converterInfo.innerHTML = '<p><strong>Conversión exitosa</strong></p>';
            } else {
                // Múltiples archivos, crear ZIP
                const zip = new JSZip();

                for (let i = 0; i < converterFiles.length; i++) {
                    const file = converterFiles[i];
                    const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                    updateProgress(converterProgress, `Convirtiendo ${file.name}...`, (i / converterFiles.length) * 100);

                    const convertedBlob = await convertAudioFormat(file, outputFormat, converterProgress);
                    zip.file(fileName, convertedBlob);
                }

                updateProgress(converterProgress, 'Generando ZIP...', 95);
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                downloadFile(zipBlob, `audios-convertidos-${Date.now()}.zip`);

                updateProgress(converterProgress, 'Conversión exitosa', 100);
                converterInfo.className = 'info-box success';
                converterInfo.innerHTML = '<p><strong>Conversión exitosa</strong></p><p>ZIP descargado</p>';
            }

            setTimeout(() => {
                converterProgress.style.display = 'none';
                convertAudioBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error convirtiendo audio:', error);
            converterInfo.className = 'info-box error';
            converterInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            converterProgress.style.display = 'none';
            convertAudioBtn.disabled = false;
        }
    });
}

async function convertAudioFormat(file, targetFormat, progressContainer) {
    // Si es video, extraer audio primero
    if (file.type.startsWith('video/')) {
        const audioBlob = await extractAudioFromVideo(file, (progress, message) => {
            if (progressContainer) {
                updateProgress(progressContainer, message, progress * 0.7);
            }
        });

        if (progressContainer) {
            updateProgress(progressContainer, 'Convirtiendo...', 70);
        }

        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return bufferToWave(audioBuffer);
    }

    // Si es audio, procesar directamente
    if (progressContainer) {
        updateProgress(progressContainer, 'Convirtiendo...', 50);
    }

    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return bufferToWave(audioBuffer);
}

// ==================== EXTRACTOR DE AUDIO DE VIDEO ====================
function initVideoExtractor() {
    const videoFileInput = document.getElementById('video-file');
    const extractAudioBtn = document.getElementById('extract-audio-btn');
    const extractFormatSelect = document.getElementById('extract-format');
    const extractorInfo = document.getElementById('extractor-info');
    const extractorProgress = document.getElementById('extractor-progress');
    const uploadArea = document.getElementById('video-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('extractor-file-list');

    let videoFiles = [];

    videoFileInput.addEventListener('change', (e) => {
        videoFiles = Array.from(e.target.files);
        if (videoFiles.length > 0) {
            // Actualizar el label y área de upload
            if (uploadLabel) {
                uploadLabel.textContent = `${videoFiles.length} video(s) seleccionado(s)`;
                uploadLabel.style.color = 'var(--accent)';
            }
            uploadArea.classList.add('has-files');

            extractorInfo.style.display = 'block';
            extractorInfo.className = 'info-box';
            extractorInfo.innerHTML = `<p><strong>${videoFiles.length}</strong> video(s) seleccionado(s)</p>`;

            // Mostrar lista de archivos
            displayFileList(videoFiles, fileList);

            extractAudioBtn.style.display = 'block';
        }
    });

    extractAudioBtn.addEventListener('click', async () => {
        if (videoFiles.length === 0) return;

        const outputFormat = extractFormatSelect.value;

        extractorProgress.style.display = 'block';
        extractAudioBtn.disabled = true;

        try {
            if (videoFiles.length === 1) {
                const file = videoFiles[0];
                updateProgress(extractorProgress, 'Extrayendo audio...', 0);

                const audioBlob = await extractAudioFromVideo(file, (progress, message) => {
                    updateProgress(extractorProgress, message, progress);
                });

                const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                downloadFile(audioBlob, fileName);

                updateProgress(extractorProgress, 'Completado', 100);
                extractorInfo.className = 'info-box success';
                extractorInfo.innerHTML = '<p><strong>Audio extraido exitosamente</strong></p>';
            } else {
                const zip = new JSZip();

                for (let i = 0; i < videoFiles.length; i++) {
                    const file = videoFiles[i];
                    const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                    const baseProgress = (i / videoFiles.length) * 100;

                    const audioBlob = await extractAudioFromVideo(file, (progress, message) => {
                        const totalProgress = baseProgress + (progress / videoFiles.length);
                        updateProgress(extractorProgress, `[${i + 1}/${videoFiles.length}] ${message}`, totalProgress);
                    });

                    zip.file(fileName, audioBlob);
                }

                updateProgress(extractorProgress, 'Generando ZIP...', 95);
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                downloadFile(zipBlob, `audios-extraidos-${Date.now()}.zip`);

                updateProgress(extractorProgress, 'Completado', 100);
                extractorInfo.className = 'info-box success';
                extractorInfo.innerHTML = '<p><strong>Audios extraidos exitosamente</strong></p>';
            }

            setTimeout(() => {
                extractorProgress.style.display = 'none';
                extractAudioBtn.disabled = false;
            }, 2000);

        } catch (error) {
            console.error('Error extrayendo audio:', error);
            extractorInfo.className = 'info-box error';
            extractorInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            extractorProgress.style.display = 'none';
            extractAudioBtn.disabled = false;
        }
    });
}

async function extractAudioFromVideo(videoFile, progressCallback = null) {
    console.log('Iniciando extracción de:', videoFile.name, 'Tipo:', videoFile.type);

    // Primero intentar decodificar directamente como audio
    // Archivos como .m4a, .mp3, .aac con extensión .mp4 a veces funcionan
    try {
        console.log('Intentando decodificar como audio directo...');
        if (progressCallback) progressCallback(5, 'Cargando archivo...');

        const arrayBuffer = await videoFile.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        if (progressCallback) progressCallback(15, 'Decodificando...');

        try {
            const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
            console.log('Es audio directo! Duración:', decoded.duration, 'segundos');
            if (progressCallback) progressCallback(100, 'Completado');
            // Si funciona, devolver el archivo original
            return videoFile;
        } catch (decodeError) {
            console.log('No es audio directo:', decodeError.message);
        }
    } catch (err) {
        console.log('Error leyendo archivo:', err.message);
    }

    // Método alternativo: usar fetch para videos que el navegador no puede decodificar como audio
    console.log('Intentando extraer como video...');
    if (progressCallback) progressCallback(0, 'Preparando extracción...');

    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.muted = true;
        video.preload = 'metadata';

        // Agregar al DOM (oculto)
        video.style.position = 'fixed';
        video.style.left = '-9999px';
        video.style.opacity = '0';
        document.body.appendChild(video);

        let hasResolved = false;
        let audioContext = null;
        let mediaRecorder = null;

        const cleanup = () => {
            console.log('Limpiando recursos...');
            if (video.parentNode) {
                document.body.removeChild(video);
            }
            if (video.src) {
                URL.revokeObjectURL(video.src);
            }
            if (audioContext) {
                audioContext.close();
            }
        };

        const timeout = setTimeout(() => {
            if (!hasResolved) {
                hasResolved = true;
                console.log('Timeout alcanzado');
                cleanup();
                reject(new Error('Tiempo agotado. Tu navegador no puede procesar este formato de video. Intenta convertirlo primero con VLC o similar.'));
            }
        }, 2 * 60 * 1000); // 2 minutos

        video.src = URL.createObjectURL(videoFile);

        // Actualizar progreso durante la reproducción
        video.addEventListener('timeupdate', () => {
            if (video.duration && progressCallback) {
                const progress = Math.round((video.currentTime / video.duration) * 100);
                // Mapear 0-100% a 30-90% de la barra total
                const mappedProgress = 30 + (progress * 0.6);
                progressCallback(mappedProgress, 'Extrayendo audio... ' + progress + '%');
            }
        });

        video.addEventListener('loadedmetadata', () => {
            console.log('Metadata cargada. Duración:', video.duration, 'segundos');

            if (!video.duration || video.duration === Infinity) {
                hasResolved = true;
                clearTimeout(timeout);
                cleanup();
                reject(new Error('Formato no compatible. Usa un archivo MP4, WEBM o MOV estándar.'));
                return;
            }

            if (progressCallback) progressCallback(20, 'Preparando extracción...');

            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const destination = audioContext.createMediaStreamDestination();
                const source = audioContext.createMediaElementSource(video);
                source.connect(destination);
                source.connect(audioContext.destination); // También conectar al destino normal

                mediaRecorder = new MediaRecorder(destination.stream);
                const chunks = [];

                mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        console.log('Chunk recibido:', e.data.size, 'bytes');
                        chunks.push(e.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(timeout);
                        console.log('Grabación completada. Chunks:', chunks.length);
                        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
                        cleanup();
                        if (progressCallback) progressCallback(100, 'Completado');
                        resolve(audioBlob);
                    }
                };

                mediaRecorder.onerror = (e) => {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(timeout);
                        console.log('Error MediaRecorder:', e);
                        cleanup();
                        reject(new Error('Error al grabar: ' + (e.error || 'desconocido')));
                    }
                };

                video.addEventListener('ended', () => {
                    console.log('Video terminado');
                    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                        mediaRecorder.stop();
                    }
                });

                // Comenzar grabación
                console.log('Iniciando grabación...');
                mediaRecorder.start(100);

                // Reproducir video
                console.log('Reproduciendo video...');
                video.play()
                    .then(() => {
                        console.log('Video reproduciéndose');
                    })
                    .catch(err => {
                        if (!hasResolved) {
                            hasResolved = true;
                            clearTimeout(timeout);
                            console.log('Error al reproducir:', err);
                            cleanup();
                            reject(new Error('No se pudo reproducir. Formato no compatible con el navegador.'));
                        }
                    });

            } catch (error) {
                if (!hasResolved) {
                    hasResolved = true;
                    clearTimeout(timeout);
                    console.log('Error en setup:', error);
                    cleanup();
                    reject(new Error('Error de configuración: ' + error.message));
                }
            }
        });

        video.addEventListener('error', () => {
            if (!hasResolved) {
                hasResolved = true;
                clearTimeout(timeout);
                let errorMsg = 'Error al cargar el video.';
                if (video.error) {
                    console.log('Error de video, código:', video.error.code);
                    switch (video.error.code) {
                        case 1: errorMsg = 'Carga abortada.'; break;
                        case 2: errorMsg = 'Error de red al cargar.'; break;
                        case 3: errorMsg = 'Error de decodificación. Formato no soportado.'; break;
                        case 4: errorMsg = 'Formato no soportado por el navegador. Intenta convertirlo primero con VLC.'; break;
                    }
                }
                cleanup();
                reject(new Error(errorMsg));
            }
        });

        // Cargar el video
        console.log('Cargando video...');
        video.load();
    });
}

// ==================== TEMPORIZADOR POMODORO ====================
function initPomodoro() {
    let timerInterval = null;
    let timeLeft = 25 * 60; // 25 minutos en segundos
    let isRunning = false;
    let isWorkSession = true;
    let sessionsCompleted = 0;
    let currentCycle = 1;

    const timerDisplay = document.getElementById('timer-display');
    const timerLabel = document.getElementById('timer-label');
    const startBtn = document.getElementById('start-pomodoro');
    const pauseBtn = document.getElementById('pause-pomodoro');
    const resetBtn = document.getElementById('reset-pomodoro');
    const workDurationInput = document.getElementById('work-duration');
    const breakDurationInput = document.getElementById('break-duration');
    const longBreakDurationInput = document.getElementById('long-break-duration');
    const sessionsCountSpan = document.getElementById('sessions-count');
    const currentCycleSpan = document.getElementById('current-cycle');
    const timerCircleProgress = document.querySelector('.timer-circle-progress');

    function updateDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const totalTime = isWorkSession
            ? parseInt(workDurationInput.value) * 60
            : (currentCycle % 4 === 0 ? parseInt(longBreakDurationInput.value) : parseInt(breakDurationInput.value)) * 60;

        const progress = (timeLeft / totalTime) * 565.48;
        timerCircleProgress.style.strokeDashoffset = 565.48 - progress;
    }

    function startTimer() {
        if (isRunning) return;

        isRunning = true;
        startBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';

        timerInterval = setInterval(() => {
            timeLeft--;
            updateDisplay();

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                playNotificationSound();

                if (isWorkSession) {
                    sessionsCompleted++;
                    sessionsCountSpan.textContent = sessionsCompleted;

                    if (currentCycle % 4 === 0) {
                        timeLeft = parseInt(longBreakDurationInput.value) * 60;
                        timerLabel.textContent = 'Descanso Largo';
                        currentCycle = 1;
                    } else {
                        timeLeft = parseInt(breakDurationInput.value) * 60;
                        timerLabel.textContent = 'Descanso';
                        currentCycle++;
                    }
                    isWorkSession = false;
                } else {
                    timeLeft = parseInt(workDurationInput.value) * 60;
                    timerLabel.textContent = 'Trabajo';
                    isWorkSession = true;
                }

                currentCycleSpan.textContent = `${currentCycle}/4`;
                updateDisplay();
                isRunning = false;
                startBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }

    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        isWorkSession = true;
        timeLeft = parseInt(workDurationInput.value) * 60;
        timerLabel.textContent = 'Trabajo';
        startBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
        updateDisplay();
    }

    startBtn.addEventListener('click', startTimer);
    pauseBtn.addEventListener('click', pauseTimer);
    resetBtn.addEventListener('click', resetTimer);

    updateDisplay();
}

function playNotificationSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// ==================== GENERADOR DE RUIDO BLANCO ====================
function initWhiteNoise() {
    let audioContext = null;
    let noiseSource = null;
    let gainNode = null;
    let isPlaying = false;
    let currentNoiseType = null;

    const noiseBtns = document.querySelectorAll('.noise-btn');
    const playBtn = document.getElementById('play-noise');
    const stopBtn = document.getElementById('stop-noise');
    const volumeSlider = document.getElementById('noise-volume');
    const volumeValue = document.getElementById('volume-value');
    const noiseStatus = document.getElementById('noise-status');
    const currentNoiseSpan = document.getElementById('current-noise');

    noiseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            noiseBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentNoiseType = btn.getAttribute('data-type');

            if (isPlaying) {
                stopNoise();
                playNoise();
            }
        });
    });

    volumeSlider.addEventListener('input', (e) => {
        const volume = e.target.value;
        volumeValue.textContent = volume + '%';

        if (gainNode) {
            gainNode.gain.value = volume / 100;
        }
    });

    playBtn.addEventListener('click', () => {
        if (!currentNoiseType) {
            alert('Por favor selecciona un tipo de ruido primero');
            return;
        }
        playNoise();
    });

    stopBtn.addEventListener('click', stopNoise);

    function playNoise() {
        if (isPlaying) return;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioContext.createGain();
        gainNode.gain.value = volumeSlider.value / 100;

        switch (currentNoiseType) {
            case 'white':
                noiseSource = createWhiteNoise(audioContext);
                currentNoiseSpan.textContent = 'Ruido Blanco';
                break;
            case 'pink':
                noiseSource = createPinkNoise(audioContext);
                currentNoiseSpan.textContent = 'Ruido Rosa';
                break;
            case 'brown':
                noiseSource = createBrownNoise(audioContext);
                currentNoiseSpan.textContent = 'Ruido Marrón';
                break;
            case 'rain':
                noiseSource = createRainNoise(audioContext);
                currentNoiseSpan.textContent = 'Lluvia';
                break;
            case 'ocean':
                noiseSource = createOceanNoise(audioContext);
                currentNoiseSpan.textContent = 'Olas del Mar';
                break;
            case 'forest':
                noiseSource = createForestNoise(audioContext);
                currentNoiseSpan.textContent = 'Bosque';
                break;
        }

        if (noiseSource) {
            noiseSource.connect(gainNode);
            gainNode.connect(audioContext.destination);
            noiseSource.start();

            isPlaying = true;
            playBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            noiseStatus.style.display = 'block';
        }
    }

    function stopNoise() {
        if (!isPlaying) return;

        if (noiseSource) {
            noiseSource.stop();
            noiseSource = null;
        }

        if (audioContext) {
            audioContext.close();
            audioContext = null;
        }

        isPlaying = false;
        playBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        noiseStatus.style.display = 'none';
    }
}

function createWhiteNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = audioContext.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    return whiteNoise;
}

function createPinkNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        output[i] *= 0.11;
        b6 = white * 0.115926;
    }

    const pinkNoise = audioContext.createBufferSource();
    pinkNoise.buffer = noiseBuffer;
    pinkNoise.loop = true;

    return pinkNoise;
}

function createBrownNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
    }

    const brownNoise = audioContext.createBufferSource();
    brownNoise.buffer = noiseBuffer;
    brownNoise.loop = true;

    return brownNoise;
}

function createRainNoise(audioContext) {
    const bufferSize = 2 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        const filtered = white * (0.3 + Math.sin(i / 1000) * 0.2);
        output[i] = filtered;
    }

    const rainNoise = audioContext.createBufferSource();
    rainNoise.buffer = noiseBuffer;
    rainNoise.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    rainNoise.connect(filter);

    return filter;
}

function createOceanNoise(audioContext) {
    const bufferSize = 4 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const wave1 = Math.sin(i / 8000) * 0.3;
        const wave2 = Math.sin(i / 12000) * 0.2;
        const noise = (Math.random() * 2 - 1) * 0.1;
        output[i] = wave1 + wave2 + noise;
    }

    const oceanNoise = audioContext.createBufferSource();
    oceanNoise.buffer = noiseBuffer;
    oceanNoise.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;

    oceanNoise.connect(filter);

    return filter;
}

function createForestNoise(audioContext) {
    const bufferSize = 4 * audioContext.sampleRate;
    const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
        const base = (Math.random() * 2 - 1) * 0.05;
        const birds = Math.random() < 0.001 ? (Math.random() * 2 - 1) * 0.3 : 0;
        const wind = Math.sin(i / 15000) * 0.15;
        output[i] = base + birds + wind;
    }

    const forestNoise = audioContext.createBufferSource();
    forestNoise.buffer = noiseBuffer;
    forestNoise.loop = true;

    const filter = audioContext.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 0.5;

    forestNoise.connect(filter);

    return filter;
}

// ==================== FUNCIONES AUXILIARES ====================
function bufferToWave(audioBuffer) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);
    const channels = [];
    let offset = 0;
    let pos = 0;

    // Escribir encabezado WAV
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChannels);
    setUint32(audioBuffer.sampleRate);
    setUint32(audioBuffer.sampleRate * 2 * numOfChannels); // avg. bytes/sec
    setUint16(numOfChannels * 2); // block-align
    setUint16(16); // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // Escribir datos de audio entrelazados
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
        channels.push(audioBuffer.getChannelData(i));
    }

    while (pos < length) {
        for (let i = 0; i < numOfChannels; i++) {
            let sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([buffer], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}

function updateProgress(progressContainer, text, percentage) {
    const progressBar = progressContainer.querySelector('.progress-fill');
    const progressText = progressContainer.querySelector('.progress-text');

    progressBar.style.width = percentage + '%';
    progressText.textContent = text;
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function displayFileList(files, container) {
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = '';

    files.forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';

        const isVideo = file.type.startsWith('video/');
        const isAudio = file.type.startsWith('audio/');
        const icon = isVideo ? 'V' : isAudio ? 'A' : 'F';

        const fileSize = (file.size / (1024 * 1024)).toFixed(2);

        fileItem.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${icon}</span>
                <div class="file-details">
                    <span class="file-name" title="${file.name}">${file.name}</span>
                    <span class="file-meta">${file.type || 'Desconocido'}</span>
                </div>
            </div>
            <span class="file-size">${fileSize} MB</span>
        `;

        container.appendChild(fileItem);
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
