(() => {
// Compress uploads into metadata-free WebP in the browser.
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 960;
const MAX_STORED_BYTES = 350 * 1024;
const OUTPUT_MIME = "image/webp";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo."));
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

function canvasToDataUrl(canvas, quality) {
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
    }, OUTPUT_MIME, quality);
  });
}

async function prepareItemPhoto(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Choose an image file for the item photo.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("Photo is too large. Choose an image under 12 MB.");
  }

  const sourceUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceUrl);
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable in this browser.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of [0.82, 0.72, 0.62, 0.52]) {
    const dataUrl = await canvasToDataUrl(canvas, quality);
    if (dataUrl.length * 0.75 <= MAX_STORED_BYTES) return dataUrl;
  }
  throw new Error("Photo could not be compressed enough to save. Try a smaller image.");
}

window.prepareItemPhoto = prepareItemPhoto;
})();
