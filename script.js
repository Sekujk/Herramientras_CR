// ==================== NAVEGACIÓN ENTRE HERRAMIENTAS ====================
const progressThrottle = {}; // Para throttle de actualizaciones de progreso
let isProcessing = false; // Rastrear si hay procesamiento en curso

// Aviso antes de cerrar si hay procesamiento
window.addEventListener('beforeunload', (event) => {
    if (isProcessing) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
});

// Función para ejecutar promesas con concurrencia limitada
async function promiseLimit(promises, concurrency = 6) {
    const results = [];
    const executing = [];

    for (let i = 0; i < promises.length; i++) {
        const promise = promises[i]().then(result => {
            executing.splice(executing.indexOf(promise), 1);
            return result;
        });

        results.push(promise);
        executing.push(promise);

        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }

    return Promise.all(results);
}

// Almacenamiento de blobs completados para descarga
const fileBlobs = {};

// Crear barra de progreso dinámica con botón de descarga
function createProgressBar(containerId, fileName) {
    const container = document.getElementById(containerId);
    const progressId = `progress-${Date.now()}-${Math.random()}`;
    const downloadId = `download-${progressId}`;

    const progressDiv = document.createElement('div');
    progressDiv.className = 'progress-item';
    progressDiv.id = progressId;
    progressDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="font-size: 0.9rem; color: var(--text); word-break: break-word; flex: 1;">${fileName}</div>
            <button id="${downloadId}" class="download-btn" disabled>Descargar</button>
        </div>
        <div class="progress-bar">
            <div class="progress-fill"></div>
        </div>
        <p class="progress-text">Iniciando...</p>
    `;

    container.appendChild(progressDiv);

    // Guardar referencias para descarga
    fileBlobs[progressId] = {
        downloadId,
        fileName,
        blob: null,
        ready: false
    };

    return progressId;
}

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
    const cutterClearBtn = document.getElementById('cutter-clear-btn');
    const segmentDurationInput = document.getElementById('segment-duration');
    const cutterInfo = document.getElementById('cutter-info');
    const cutterProgress = document.getElementById('cutter-progress');
    const uploadArea = document.getElementById('cutter-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('cutter-file-list');

    let selectedFiles = [];

    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileDisplay();
    }

    function clearAllFiles() {
        selectedFiles = [];
        audioFileInput.value = '';
        updateFileDisplay();
    }

    function updateFileDisplay() {
        if (selectedFiles.length === 0) {
            fileList.style.display = 'none';
            uploadArea.classList.remove('has-files');
            cutterProgress.innerHTML = '';
            cutterProgress.style.display = 'none';
            if (uploadLabel) {
                uploadLabel.textContent = 'Arrastra MÚLTIPLES archivos aquí o haz clic (sin límite)';
                uploadLabel.style.color = 'var(--text-dim)';
            }
            cutterInfo.style.display = 'none';
            cutAudioBtn.style.display = 'none';
            cutterClearBtn.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        uploadArea.classList.add('has-files');
        cutterClearBtn.style.display = 'inline-block';

        const totalSize = selectedFiles.reduce((acc, file) => acc + file.size, 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const audioFiles = selectedFiles.filter(f => f.type.startsWith('audio/')).length;
        const videoFiles = selectedFiles.filter(f => f.type.startsWith('video/')).length;

        if (uploadLabel) {
            uploadLabel.textContent = `${selectedFiles.length} archivo(s) seleccionado(s)`;
            uploadLabel.style.color = 'var(--accent)';
        }

        cutterInfo.style.display = 'block';
        cutterInfo.className = 'info-box';
        cutterInfo.innerHTML = `
            <p><strong>${selectedFiles.length}</strong> archivo(s) seleccionado(s)</p>
            ${videoFiles > 0 ? `<p>${videoFiles} video(s) - se extraerá el audio automáticamente</p>` : ''}
            ${audioFiles > 0 ? `<p>${audioFiles} audio(s)</p>` : ''}
            <p>Tamaño total: <strong>${sizeMB} MB</strong></p>
        `;

        fileList.innerHTML = '';
        selectedFiles.forEach((file, index) => {
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
                        <span class="file-meta">${fileSize} MB</span>
                    </div>
                </div>
                <button class="remove-file-btn" onclick="window.cutterRemoveFile(${index})" title="Eliminar archivo">✕</button>
            `;
            fileList.appendChild(fileItem);
        });

        cutAudioBtn.style.display = 'block';
    }

    window.cutterRemoveFile = removeFile;
    window.cutterClearAll = clearAllFiles;

    audioFileInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files);
        selectedFiles = selectedFiles.concat(newFiles);
        audioFileInput.value = '';
        updateFileDisplay();
    });

    cutAudioBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        const segmentDuration = parseInt(segmentDurationInput.value) * 60;

        cutterProgress.innerHTML = ''; // Limpiar barras previas
        cutterProgress.style.display = 'block';
        cutAudioBtn.disabled = true;
        isProcessing = true;

        try {
            const progressIds = {};

            // Crear barras de progreso para cada archivo
            for (const file of selectedFiles) {
                const progressId = createProgressBar('cutter-progress', file.name);
                progressIds[file.name] = progressId;
            }

            // Procesar archivos en paralelo (máximo 2 simultáneamente)
            const filePromises = selectedFiles.map(file => async () => {
                const fileName = file.name.replace(/\.[^/.]+$/, "");
                const progressId = progressIds[file.name];
                let progressContainer; // Declarar fuera del try para que esté disponible en catch

                try {
                    progressContainer = document.getElementById(progressId);
                    updateProgressById(progressContainer, `Cargando ${file.name}...`, 10);

                    let audioBuffer;

                    // Detectar si es video y extraer audio
                    if (file.type.startsWith('video/')) {
                        const audioBlob = await extractAudioFromVideo(file, (videoProgress, message) => {
                            updateProgressById(progressContainer, message, videoProgress * 0.5);
                        });
                        const arrayBuffer = await audioBlob.arrayBuffer();
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    } else {
                        const arrayBuffer = await file.arrayBuffer();
                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    }

                    updateProgressById(progressContainer, `Cortando ${file.name}...`, 50);

                    const duration = audioBuffer.duration;
                    const numSegments = Math.ceil(duration / segmentDuration);

                    // Crear un ZIP por archivo
                    const zip = new JSZip();

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

                        const progress = 50 + (i / numSegments) * 40;
                        updateProgressById(progressContainer, `Segmento ${i + 1}/${numSegments}`, progress);
                    }

                    // Generar ZIP
                    updateProgressById(progressContainer, 'Generando ZIP...', 95);
                    const zipBlob = await zip.generateAsync({ type: 'blob' });

                    updateProgressById(progressContainer, 'Completado', 100);

                    // Guardar blob y activar botón
                    fileBlobs[progressId].blob = zipBlob;
                    fileBlobs[progressId].ready = true;
                    const downloadBtn = document.getElementById(fileBlobs[progressId].downloadId);
                    if (downloadBtn) {
                        downloadBtn.disabled = false;
                        downloadBtn.addEventListener('click', () => {
                            downloadFile(zipBlob, `${fileName}-cortado.zip`);
                        });
                    }

                    return { success: true, file: file.name };
                } catch (error) {
                    updateProgressById(progressContainer, `Error: ${error.message}`, 0);
                    return { success: false, file: file.name, error };
                }
            });

            await promiseLimit(filePromises, 6);

            cutterInfo.className = 'info-box success';
            cutterInfo.innerHTML = '<p><strong>Archivos procesados</strong></p><p>Haz clic en el botón de descarga para obtener tu archivo</p>';
            cutterInfo.style.display = 'block';

            setTimeout(() => {
                cutAudioBtn.disabled = false;
                isProcessing = false;
            }, 500);

        } catch (error) {
            console.error('Error:', error);
            cutterInfo.className = 'info-box error';
            cutterInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            cutterInfo.style.display = 'block';
            cutterProgress.style.display = 'none';
            cutAudioBtn.disabled = false;
            isProcessing = false;
        }
    });
}

// ==================== CONVERTIDOR DE AUDIO ====================
function initAudioConverter() {
    const converterFileInput = document.getElementById('converter-file');
    const convertAudioBtn = document.getElementById('convert-audio-btn');
    const converterClearBtn = document.getElementById('converter-clear-btn');
    const outputFormatSelect = document.getElementById('output-format');
    const converterInfo = document.getElementById('converter-info');
    const converterProgress = document.getElementById('converter-progress');
    const uploadArea = document.getElementById('converter-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('converter-file-list');

    let converterFiles = [];

    function removeFile(index) {
        converterFiles.splice(index, 1);
        updateFileDisplay();
    }

    function clearAllFiles() {
        converterFiles = [];
        converterFileInput.value = '';
        updateFileDisplay();
    }

    function updateFileDisplay() {
        if (converterFiles.length === 0) {
            fileList.style.display = 'none';
            uploadArea.classList.remove('has-files');
            converterProgress.innerHTML = '';
            converterProgress.style.display = 'none';
            if (uploadLabel) {
                uploadLabel.textContent = 'Arrastra MÚLTIPLES archivos aquí o haz clic';
                uploadLabel.style.color = 'var(--text-dim)';
            }
            converterInfo.style.display = 'none';
            convertAudioBtn.style.display = 'none';
            converterClearBtn.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        uploadArea.classList.add('has-files');
        converterClearBtn.style.display = 'inline-block';

        const totalSize = converterFiles.reduce((acc, file) => acc + file.size, 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const audioFiles = converterFiles.filter(f => f.type.startsWith('audio/')).length;
        const videoFiles = converterFiles.filter(f => f.type.startsWith('video/')).length;

        if (uploadLabel) {
            uploadLabel.textContent = `${converterFiles.length} archivo(s) seleccionado(s)`;
            uploadLabel.style.color = 'var(--accent)';
        }

        converterInfo.style.display = 'block';
        converterInfo.className = 'info-box';
        converterInfo.innerHTML = `
            <p><strong>${converterFiles.length}</strong> archivo(s) seleccionado(s) para convertir</p>
            ${videoFiles > 0 ? `<p>${videoFiles} video(s) - se extraerá el audio primero</p>` : ''}
            ${audioFiles > 0 ? `<p>${audioFiles} audio(s)</p>` : ''}
            <p>Tamaño total: <strong>${sizeMB} MB</strong></p>
        `;

        fileList.innerHTML = '';
        converterFiles.forEach((file, index) => {
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
                        <span class="file-meta">${fileSize} MB</span>
                    </div>
                </div>
                <button class="remove-file-btn" onclick="window.converterRemoveFile(${index})" title="Eliminar archivo">✕</button>
            `;
            fileList.appendChild(fileItem);
        });

        convertAudioBtn.style.display = 'block';
    }

    window.converterRemoveFile = removeFile;
    window.converterClearAll = clearAllFiles;

    converterFileInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files);
        converterFiles = converterFiles.concat(newFiles);
        converterFileInput.value = '';
        updateFileDisplay();
    });

    convertAudioBtn.addEventListener('click', async () => {
        if (converterFiles.length === 0) return;

        const outputFormat = outputFormatSelect.value;

        converterProgress.style.display = 'block';
        convertAudioBtn.disabled = true;
        isProcessing = true;

        try {
            if (converterFiles.length === 1) {
                // Un solo archivo, descarga directa
                const file = converterFiles[0];
                updateProgress(converterProgress, `Convirtiendo ${file.name}...`, 50);

                const convertedBlob = await convertAudioFormat(file, outputFormat, converterProgress);
                const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                updateProgress(converterProgress, 'Conversión exitosa', 100);
                converterInfo.className = 'info-box success';
                converterInfo.innerHTML = '<p><strong>Conversión exitosa</strong></p>';

                downloadFile(convertedBlob, fileName);
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

                updateProgress(converterProgress, 'Conversión exitosa', 100);
                converterInfo.className = 'info-box success';
                converterInfo.innerHTML = '<p><strong>Conversión exitosa</strong></p><p>ZIP descargado</p>';

                downloadFile(zipBlob, `audios-convertidos-${Date.now()}.zip`);
            }

            setTimeout(() => {
                converterProgress.style.display = 'none';
                convertAudioBtn.disabled = false;
                isProcessing = false;
            }, 500);

        } catch (error) {
            console.error('Error convirtiendo audio:', error);
            converterInfo.className = 'info-box error';
            converterInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            converterProgress.style.display = 'none';
            convertAudioBtn.disabled = false;
            isProcessing = false;
        }
    });
}

async function convertAudioFormat(file, targetFormat, progressContainer) {
    try {
        // Si es video, extraer audio primero
        if (file.type.startsWith('video/')) {
            const audioBlob = await extractAudioFromVideo(file, (progress, message) => {
                try {
                    if (progressContainer) {
                        updateProgress(progressContainer, message, progress * 0.7);
                    }
                } catch (error) {
                    console.error('Error in progress callback:', error);
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
    } catch (error) {
        console.error('Error in convertAudioFormat:', error);
        throw error;
    }
}

// ==================== EXTRACTOR DE AUDIO DE VIDEO ====================
function initVideoExtractor() {
    const videoFileInput = document.getElementById('video-file');
    const extractAudioBtn = document.getElementById('extract-audio-btn');
    const extractorClearBtn = document.getElementById('extractor-clear-btn');
    const extractFormatSelect = document.getElementById('extract-format');
    const extractorInfo = document.getElementById('extractor-info');
    const extractorProgress = document.getElementById('extractor-progress');
    const uploadArea = document.getElementById('video-upload-area');
    const uploadLabel = uploadArea.querySelector('label span:last-child');
    const fileList = document.getElementById('extractor-file-list');

    let videoFiles = [];

    function removeFile(index) {
        videoFiles.splice(index, 1);
        updateFileDisplay();
    }

    function clearAllFiles() {
        videoFiles = [];
        videoFileInput.value = '';
        updateFileDisplay();
    }

    function updateFileDisplay() {
        if (videoFiles.length === 0) {
            fileList.style.display = 'none';
            uploadArea.classList.remove('has-files');
            extractorProgress.innerHTML = '';
            extractorProgress.style.display = 'none';
            if (uploadLabel) {
                uploadLabel.textContent = 'Arrastra MÚLTIPLES videos aquí o haz clic';
                uploadLabel.style.color = 'var(--text-dim)';
            }
            extractorInfo.style.display = 'none';
            extractAudioBtn.style.display = 'none';
            extractorClearBtn.style.display = 'none';
            return;
        }

        fileList.style.display = 'block';
        uploadArea.classList.add('has-files');
        extractorClearBtn.style.display = 'inline-block';

        const totalSize = videoFiles.reduce((acc, file) => acc + file.size, 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        if (uploadLabel) {
            uploadLabel.textContent = `${videoFiles.length} video(s) seleccionado(s)`;
            uploadLabel.style.color = 'var(--accent)';
        }

        extractorInfo.style.display = 'block';
        extractorInfo.className = 'info-box';
        extractorInfo.innerHTML = `
            <p><strong>${videoFiles.length}</strong> video(s) seleccionado(s)</p>
            <p>Tamaño total: <strong>${sizeMB} MB</strong></p>
        `;

        fileList.innerHTML = '';
        videoFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            const isVideo = file.type.startsWith('video/');
            const icon = isVideo ? 'V' : 'F';
            const fileSize = (file.size / (1024 * 1024)).toFixed(2);

            fileItem.innerHTML = `
                <div class="file-info">
                    <span class="file-icon">${icon}</span>
                    <div class="file-details">
                        <span class="file-name" title="${file.name}">${file.name}</span>
                        <span class="file-meta">${fileSize} MB</span>
                    </div>
                </div>
                <button class="remove-file-btn" onclick="window.extractorRemoveFile(${index})" title="Eliminar archivo">✕</button>
            `;
            fileList.appendChild(fileItem);
        });

        extractAudioBtn.style.display = 'block';
    }

    window.extractorRemoveFile = removeFile;
    window.extractorClearAll = clearAllFiles;

    videoFileInput.addEventListener('change', (e) => {
        const newFiles = Array.from(e.target.files);
        videoFiles = videoFiles.concat(newFiles);
        videoFileInput.value = '';
        updateFileDisplay();
    });

    extractAudioBtn.addEventListener('click', async () => {
        if (videoFiles.length === 0) return;

        const outputFormat = extractFormatSelect.value;

        extractorProgress.style.display = 'block';
        extractAudioBtn.disabled = true;
        isProcessing = true;

        try {
            if (videoFiles.length === 1) {
                const file = videoFiles[0];
                updateProgress(extractorProgress, 'Extrayendo audio...', 0);

                const audioBlob = await extractAudioFromVideo(file, (progress, message) => {
                    updateProgress(extractorProgress, message, progress);
                });

                const fileName = file.name.replace(/\.[^/.]+$/, "") + '.' + outputFormat;

                updateProgress(extractorProgress, 'Completado', 100);
                extractorInfo.className = 'info-box success';
                extractorInfo.innerHTML = '<p><strong>Audio extraido exitosamente</strong></p>';

                downloadFile(audioBlob, fileName);
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

                updateProgress(extractorProgress, 'Completado', 100);
                extractorInfo.className = 'info-box success';
                extractorInfo.innerHTML = '<p><strong>Audios extraidos exitosamente</strong></p>';

                downloadFile(zipBlob, `audios-extraidos-${Date.now()}.zip`);
            }

            setTimeout(() => {
                extractorProgress.style.display = 'none';
                extractAudioBtn.disabled = false;
                isProcessing = false;
            }, 500);

        } catch (error) {
            console.error('Error extrayendo audio:', error);
            extractorInfo.className = 'info-box error';
            extractorInfo.innerHTML = `<p><strong>Error:</strong> ${error.message}</p>`;
            extractorProgress.style.display = 'none';
            extractAudioBtn.disabled = false;
            isProcessing = false;
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
// Convertir AudioBuffer a MP3 usando lamejs (reduce tamaño 10x)
// Convertir AudioBuffer a WAV con samplerate reducido (22050Hz)
// Simple, rápido, confiable - funciona garantizado
function bufferToWAV(audioBuffer) {
    const targetSampleRate = 22050;
    const numOfChannels = audioBuffer.numberOfChannels;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numOfChannels * bytesPerSample;

    // Resamplear a 22050Hz
    let audioData;
    const ratio = targetSampleRate / audioBuffer.sampleRate;

    if (Math.abs(ratio - 1) < 0.001) {
        // Ya está a 22050Hz
        audioData = new Float32Array(audioBuffer.length * numOfChannels);
        for (let channel = 0; channel < numOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < audioBuffer.length; i++) {
                audioData[i * numOfChannels + channel] = channelData[i];
            }
        }
    } else {
        // Resamplear con interpolación
        const newLength = Math.floor(audioBuffer.length * ratio);
        audioData = new Float32Array(newLength * numOfChannels);

        for (let channel = 0; channel < numOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < newLength; i++) {
                const srcIndex = i / ratio;
                const srcIndexFloor = Math.floor(srcIndex);
                const srcIndexCeil = Math.ceil(srcIndex);
                const blend = srcIndex - srcIndexFloor;

                const sample1 = channelData[srcIndexFloor] || 0;
                const sample2 = channelData[srcIndexCeil] || 0;
                const blended = sample1 * (1 - blend) + sample2 * blend;

                audioData[i * numOfChannels + channel] = blended;
            }
        }
    }

    const dataLength = audioData.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    const writeUint32 = (offset, value) => {
        view.setUint32(offset, value, true);
    };

    const writeUint16 = (offset, value) => {
        view.setUint16(offset, value, true);
    };

    // WAV header
    writeString(0, 'RIFF');
    writeUint32(4, 36 + dataLength);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    writeUint32(16, 16);
    writeUint16(20, format);
    writeUint16(22, numOfChannels);
    writeUint32(24, targetSampleRate);
    writeUint32(28, targetSampleRate * blockAlign);
    writeUint16(32, blockAlign);
    writeUint16(34, bitDepth);
    writeString(36, 'data');
    writeUint32(40, dataLength);

    // Convertir Float32 a PCM 16-bit
    const converted = new Int16Array(buffer, 44);
    for (let i = 0; i < audioData.length; i++) {
        converted[i] = Math.max(-1, Math.min(1, audioData[i])) < 0 ? audioData[i] * 0x8000 : audioData[i] * 0x7FFF;
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

// Alias para compatibilidad (bufferToWAV es synchronous)
function bufferToWave(audioBuffer) {
    return bufferToWAV(audioBuffer);
}

function updateProgress(progressContainer, text, percentage) {
    if (!progressContainer || !progressContainer.id) {
        return; // Salir silenciosamente si no hay container válido
    }

    const id = progressContainer.id;

    // Throttle: no actualizar si pasó menos de 50ms desde la última actualización
    if (progressThrottle[id] && Date.now() - progressThrottle[id].lastUpdate < 50) {
        return;
    }

    try {
        const progressBar = progressContainer.querySelector('.progress-fill');
        const progressText = progressContainer.querySelector('.progress-text');

        const roundedPercentage = Math.round(percentage);

        // Solo actualizar si hubo cambio significativo
        if (progressThrottle[id]?.lastPercentage !== roundedPercentage || progressThrottle[id]?.lastText !== text) {
            if (progressBar) {
                progressBar.style.width = roundedPercentage + '%';
            }
            if (progressText) {
                progressText.textContent = text;
            }

            progressThrottle[id] = {
                lastUpdate: Date.now(),
                lastPercentage: roundedPercentage,
                lastText: text
            };
        }
    } catch (error) {
        console.error('Error updating progress:', error);
    }
}

function updateProgressById(container, text, percentage) {
    if (!container) return;

    const progressBar = container.querySelector('.progress-fill');
    const progressText = container.querySelector('.progress-text');

    const roundedPercentage = Math.round(percentage);

    if (progressBar) {
        progressBar.style.width = roundedPercentage + '%';
    }
    if (progressText) {
        progressText.textContent = text;
    }
}

function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 200);
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
