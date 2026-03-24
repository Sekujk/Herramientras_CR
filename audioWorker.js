// Web Worker simplificado - Solo procesa WAV bytes
self.onmessage = async (event) => {
    try {
        const { wavBytes, format = 'opus', bitrate = 48, id } = event.data;

        console.log(`🎵 Worker: Procesando audio ${format} ${bitrate}kbps (ID: ${id})`);

        if (!wavBytes) {
            throw new Error('No wavBytes recibidos');
        }

        console.log(`📊 Worker: WAV recibido - ${(wavBytes.length / 1024).toFixed(2)} KB`);

        // Para esta versión, solo retornamos el WAV
        // El encoding se hará en el main thread con FFmpeg
        self.postMessage({
            success: true,
            result: wavBytes.buffer,
            id: id
        }, [wavBytes.buffer]);

    } catch (error) {
        console.error('❌ Worker: Error:', error);
        self.postMessage({
            success: false,
            error: error.message,
            id: event.data.id
        });
    }
};
