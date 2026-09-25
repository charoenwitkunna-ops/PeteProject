(() => {
// Compress uploads into metadata-free WebP/JPEG in the browser.
const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // 25 MB source limit (handles 48MP phone photos)
const MAX_IMAGE_EDGE = 1000;
const MAX_STORED_BYTES = 350 * 1024; // Safe margin below server's 450 KB limit
const OUTPUT_MIME = "image/webp";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That file is not a readable image."));
    image.src = source;
  });
}

function canvasToDataUrl(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        reject(new Error("Could not prepare the photo. Try another image."));
        return;
      }
      try {
        resolve(await readFileAsDataUrl(blob));
      } catch (error) {
        reject(error);
      }
    }, mimeType, quality);
  });
}

async function prepareItemPhoto(file) {
  if (!file) {
    throw new Error("Choose an image file for the item photo.");
  }

  // Accept any image MIME type, or files ending in typical photo extensions (handles HEIC/JPEG on iOS/Android)
  const isImageMime = file.type && file.type.startsWith("image/");
  const hasImageExtension = /\.(jpe?g|png|webp|gif|bmp|heic|heif|avif)$/i.test(file.name || "");
  if (!isImageMime && !hasImageExtension) {
    throw new Error("Choose an image file for the item photo.");
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Photo is too large. Choose an image under 25 MB.");
  }

  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);

  // Resize preserving aspect ratio
  const maxEdge = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, MAX_IMAGE_EDGE / maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  // Progressive compression loop: step down resolution or quality until it is comfortably within limits
  const targetBytes = MAX_STORED_BYTES;
  const qualities = [0.80, 0.70, 0.60, 0.50, 0.40, 0.30];

  for (const quality of qualities) {
    const dataUrl = await canvasToDataUrl(canvas, OUTPUT_MIME, quality);
    // If browser supports webp export and size is within bounds
    if (dataUrl.startsWith("data:image/webp") && (dataUrl.length * 0.75) <= targetBytes) {
      return dataUrl;
    }
  }

  // If still too large, downscale canvas dimensions further and retry
  const halfCanvas = document.createElement("canvas");
  halfCanvas.width = Math.round(canvas.width * 0.7);
  halfCanvas.height = Math.round(canvas.height * 0.7);
  const halfCtx = halfCanvas.getContext("2d");
  halfCtx.fillStyle = "#ffffff";
  halfCtx.fillRect(0, 0, halfCanvas.width, halfCanvas.height);
  halfCtx.drawImage(canvas, 0, 0, halfCanvas.width, halfCanvas.height);

  for (const quality of [0.65, 0.50, 0.35]) {
    const dataUrl = await canvasToDataUrl(halfCanvas, OUTPUT_MIME, quality);
    if (dataUrl.startsWith("data:image/webp") && (dataUrl.length * 0.75) <= targetBytes) {
      return dataUrl;
    }
  }

  throw new Error("Photo could not be compressed enough to save. Try taking a photo closer or lower resolution.");
}

window.prepareItemPhoto = prepareItemPhoto;
})();
