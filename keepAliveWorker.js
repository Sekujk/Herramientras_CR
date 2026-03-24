// Keep-Alive Worker - Previene que el navegador suspenda la pestaña
// Emite ping periódicamente para mantener el worker activo también durante background

let isActive = false;
let pingInterval = null;

self.onmessage = (event) => {
    const { command } = event.data;

    if (command === 'start') {
        if (isActive) return; // Ya está activo

        isActive = true;
        console.log('🟢 Keep-Alive Worker: Iniciado - Ping cada 100ms');

        // Ping cada 100ms para mantener el worker y la pestaña activos
        pingInterval = setInterval(() => {
            if (isActive) {
                self.postMessage({
                    type: 'ping',
                    timestamp: Date.now()
                });
            }
        }, 100);

    } else if (command === 'stop') {
        if (!isActive) return; // Ya está detenido

        isActive = false;
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        console.log('🔴 Keep-Alive Worker: Detenido');
    }
};

console.log('✅ Keep-Alive Worker cargado');
