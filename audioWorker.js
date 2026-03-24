// Web Worker para procesamiento paralelo de audio con FFmpeg
let FFmpeg = null;
let ffmpeg = null;
let isLoading = false;

// Cargar FFmpeg en el contexto del worker
try {
    importScripts('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.0/dist/FFmpeg.js');
    if (typeof self.FFmpeg !== 'undefined') {
        FFmpeg = self.FFmpeg;
    }
} catch (error) {
    console.error('⚠️ Worker: No se pudo cargar FFmpeg via importScripts:', error);
}

// Inicializar FFmpeg WASM
async function initFFmpeg() {
    if (ffmpeg && ffmpeg.isLoaded && ffmpeg.isLoaded()) return;
    if (isLoading) {
        // Esperar a que termine la carga anterior
        let waits = 0;
        while (isLoading && waits < 100) {
            await new Promise(r => setTimeout(r, 100));
            waits++;
        }
        return;
    }

    if (!FFmpeg) {
        throw new Error('❌ Worker: FFmpeg no está disponible. Importación falló.');
    }

    isLoading = true;
    try {
        // Para FFmpeg 0.12.x, la API es FFmpeg.FFmpeg
        const FFmpegClass = FFmpeg.FFmpeg || FFmpeg;
        ffmpeg = new FFmpegClass();
        console.log('🔧 Worker: Cargando FFmpeg WASM...');
        await ffmpeg.load({
            coreURL: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.0/dist/ffmpeg-core.js'
        });
        console.log('✅ Worker: FFmpeg WASM cargado');
    } catch (error) {
        console.error('❌ Worker: Error cargando FFmpeg:', error);
        throw error;
    } finally {
        isLoading = false;
    }
}

// Convertir AudioBuffer a Wav bytes
function audioBufferToWav(audioBuffer) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numOfChannels * bytesPerSample;

    const wavLength = audioBuffer.length * numOfChannels * bytesPerSample + 44;
    const buffer = new ArrayBuffer(wavLength);
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

    writeString(0, 'RIFF');
    writeUint32(4, wavLength - 8);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    writeUint32(16, 16);
    writeUint16(20, format);
    writeUint16(22, numOfChannels);
    writeUint32(24, sampleRate);
    writeUint32(28, sampleRate * blockAlign);
    writeUint16(32, blockAlign);
    writeUint16(34, bitDepth);
    writeString(36, 'data');
    writeUint32(40, audioBuffer.length * numOfChannels * bytesPerSample);

    const converted = new Int16Array(buffer, 44);
    let offset = 0;

    for (let channel = 0; channel < numOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < audioBuffer.length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            converted[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
    }

    return new Uint8Array(buffer);
}

// Procesar audio con FFmpeg
async function encodeAudio(wavData, format = 'opus', bitrate = 48) {
    try {
        await initFFmpeg();

        // Limpiar files previos
        try {
            ffmpeg.FS('unlink', 'input.wav');
            ffmpeg.FS('unlink', `output.${format}`);
        } catch (e) {
            // Archivos no existen, está bien
        }

        // Escribir archivo de entrada - ensure wavData is Uint8Array
        const wavArray = new Uint8Array(wavData);
        ffmpeg.FS('writeFile', 'input.wav', wavArray);

        // Mapa de codecs
        const codecMap = {
            'opus': 'libopus',
            'mp3': 'libmp3lame',
            'aac': 'aac',
            'vorbis': 'libvorbis'
        };

        // Parámetros específicos por formato
        let ffmpegArgs = [
            '-i', 'input.wav',
            '-c:a', codecMap[format],
            '-b:a', `${bitrate}k`,
        ];

        // Agregar parámetros de calidad
        if (format === 'opus') {
            ffmpegArgs.push('-application', 'audio');
        }

        ffmpegArgs.push('-y', `output.${format}`);

        console.log('🔄 Worker: Ejecutando FFmpeg con args:', ffmpegArgs);
        await ffmpeg.run(...ffmpegArgs);

        // Leer resultado
        const data = ffmpeg.FS('readFile', `output.${format}`);

        // Limpiar
        ffmpeg.FS('unlink', 'input.wav');
        ffmpeg.FS('unlink', `output.${format}`);

        return new Uint8Array(data);
    } catch (error) {
        console.error('❌ Worker: Error en FFmpeg:', error);
        throw error;
    }
}

// Manejar mensajes del main thread
self.onmessage = async (event) => {
    try {
        const { wavBytes, format = 'opus', bitrate = 48, id } = event.data;

        console.log(`🎵 Worker: Procesando audio ${format} ${bitrate}kbps (ID: ${id})`);

        if (!wavBytes) {
            throw new Error('No wavBytes recibidos');
        }

        console.log(`📊 Worker: WAV recibido - ${(wavBytes.length / 1024).toFixed(2)} KB`);

        // Encodear con FFmpeg
        const result = await encodeAudio(wavBytes, format, bitrate);
        console.log(`✅ Worker: Encoding completado - ${(result.length / 1024).toFixed(2)} KB`);

        // Enviar resultado
        self.postMessage({
            success: true,
            result: result.buffer,
            id: id
        }, [result.buffer]);

    } catch (error) {
        console.error('❌ Worker: Error:', error);
        self.postMessage({
            success: false,
            error: error.message,
            id: event.data.id
        });
    }
};

console.log('✅ Audio Worker inicializado');
