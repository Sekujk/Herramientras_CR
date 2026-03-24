# 🎓 Herramientas de Estudio

Aplicación web con herramientas para optimizar tu estudio y concentración.

## 🚀 Características

### ✂️ Cortador de Audios
Divide archivos de audio largos (clases, conferencias, audiolibros) en segmentos más pequeños y manejables.

**Funcionalidades:**
- Soporta múltiples archivos de audio simultáneamente
- Configura la duración de cada segmento (en minutos)
- Descarga automática en formato ZIP
- Los archivos se nombran automáticamente: `nombre-original-1.wav`, `nombre-original-2.wav`, etc.
- Formatos soportados: MP3, WAV, OGG, M4A, y más

**Cómo usar:**
1. Selecciona uno o más archivos de audio
2. Define la duración de cada segmento (ej: 10 minutos)
3. Haz clic en "Cortar Audio"
4. Se descargará un ZIP con todos los segmentos

---

### 🔄 Convertidor de Audio
Convierte archivos de audio entre diferentes formatos.

**Formatos soportados:**
- MP3
- WAV
- OGG
- WEBM

**Cómo usar:**
1. Selecciona uno o más archivos de audio
2. Elige el formato de salida deseado
3. Haz clic en "Convertir Audio"
4. Los archivos se descargarán (individual o en ZIP)

---

### 🎬 Extractor de Audio de Video
Extrae la pista de audio de archivos de video para escuchar conferencias o clases sin video.

**Cómo usar:**
1. Selecciona uno o más archivos de video
2. Elige el formato de audio deseado
3. Haz clic en "Extraer Audio"
4. Se descargará el audio extraído

---

### ⏱️ Temporizador Pomodoro
Técnica de gestión del tiempo para mejorar la productividad y concentración.

**Funcionalidades:**
- Sesiones de trabajo configurables (predeterminado: 25 min)
- Descansos cortos configurables (predeterminado: 5 min)
- Descansos largos cada 4 sesiones (predeterminado: 15 min)
- Seguimiento de sesiones completadas
- Notificación sonora al finalizar cada periodo
- Interfaz visual circular con progreso

**Cómo usar:**
1. Configura la duración de trabajo, descanso corto y descanso largo
2. Haz clic en "Iniciar" para comenzar
3. El temporizador alternará automáticamente entre trabajo y descanso

---

### 🌊 Generador de Ruido Blanco
Genera sonidos ambientales para mejorar la concentración y bloquear distracciones.

**Tipos de ruido disponibles:**
- **Ruido Blanco**: Frecuencias uniformes, ideal para bloquear sonidos
- **Ruido Rosa**: Más suave que el blanco, relajante
- **Ruido Marrón**: Más profundo, como una cascada
- **Lluvia**: Simulación de lluvia constante
- **Olas del Mar**: Sonido relajante del océano
- **Bosque**: Ambiente natural con pájaros y viento

**Cómo usar:**
1. Selecciona un tipo de ruido
2. Ajusta el volumen según tu preferencia
3. Haz clic en "Reproducir"
4. Para detener, haz clic en "Detener"

---

## 💻 Instalación y Uso

**Opción 1: Abrir directamente**
1. Abre el archivo `index.html` en cualquier navegador moderno (Chrome, Firefox, Edge, Safari)

**Opción 2: Servidor local (recomendado)**
```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (http-server)
npx http-server

# Con PHP
php -S localhost:8000
```

Luego abre `http://localhost:8000` en tu navegador.

---

## 🔒 Privacidad

**Todas las operaciones se realizan localmente en tu navegador**. Ningún archivo se sube a servidores externos. Tu privacidad está 100% protegida.

## 📋 Requisitos

- Navegador moderno con soporte para:
  - Web Audio API
  - File API
  - Media Recorder API
  - ES6+

## 🛠️ Tecnologías Utilizadas

- HTML5
- CSS3 (con animaciones y diseño responsivo)
- JavaScript (Vanilla)
- Web Audio API
- JSZip (para crear archivos ZIP)

## ⚠️ Nota sobre formatos

El convertidor de audio genera archivos en formato WAV debido a las limitaciones del navegador. Para conversiones a MP3 u OGG con compresión real, se requeriría una librería adicional como FFmpeg.js, la cual es más pesada pero proporciona mayor compatibilidad.

---

## 🤝 Contribuciones

Este es un proyecto de código abierto. Siéntete libre de mejorarlo y adaptarlo a tus necesidades.

## 📝 Licencia

MIT License - Uso libre para fines educativos y personales.
