// Data Processing Worker - Copia datos de canales de audio y genera WAV bytes
// Esta tarea CPU-bound se ejecuta en worker para no bloquear main thread

// Función para convertir AudioBuffer a WAV bytes
function audioBufferToWavBytes(audioBuffer, startTime, endTime) {
    const numOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numOfChannels * bytesPerSample;

    const startSample = Math.floor(startTime * sampleRate);
    const endSample = Math.floor(endTime * sampleRate);
    const segmentLength = endSample - startSample;

    const wavLength = segmentLength * numOfChannels * bytesPerSample + 44;
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

    // Escribir RIFF header
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
    writeUint32(40, segmentLength * numOfChannels * bytesPerSample);

    // Copiar datos de audio
    const converted = new Int16Array(buffer, 44);
    let offset = 0;

    for (let channel = 0; channel < numOfChannels; channel++) {
        const channelData = audioBuffer.getChannelData(channel);
        for (let i = 0; i < segmentLength; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[startSample + i]));
            converted[offset++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        }
    }

    return new Uint8Array(buffer);
}

// Manejar mensaje del main thread
self.onmessage = async (event) => {
    try {
        const { audioBuffer, startTime, endTime, segmentIndex, id } = event.data;

        if (!audioBuffer) {
            throw new Error('AudioBuffer no recibido');
        }

        console.log(`🔄 Data Worker: Procesando segmento ${segmentIndex} (${(startTime).toFixed(2)}s - ${(endTime).toFixed(2)}s)`);

        // Convertir a WAV bytes
        const wavBytes = audioBufferToWavBytes(audioBuffer, startTime, endTime);

        console.log(`✅ Data Worker: Segmento ${segmentIndex} convertido a WAV - ${(wavBytes.length / 1024).toFixed(2)} KB`);

        // Retornar wavBytes al main thread (transferir el buffer para mejor rendimiento)
        self.postMessage(
            {
                success: true,
                wavBytes: wavBytes.buffer,
                segmentIndex,
                id
            },
            [wavBytes.buffer] // Transferable
        );

    } catch (error) {
        console.error('❌ Data Worker Error:', error);
        self.postMessage({
            success: false,
            error: error.message,
            segmentIndex: event.data?.segmentIndex,
            id: event.data?.id
        });
    }
};

console.log('✅ Data Processing Worker cargado');
