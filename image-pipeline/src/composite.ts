import sharp from "sharp";
import fs from "fs/promises";
import path from "path";
import configData from "../config/anime-cyberpunk.json" assert { type: "json" };

const cfg = configData as any;

/**
 * Composite a subject image onto a chosen background and add a logo in the top right corner.
 * If the requested background or logo cannot be found, fallback solid colours are used.
 */
export async function compositeFinal(opts: {
  subjectPath: string;
  backgroundName: "Simple Blue" | "Builder Grid" | "Dual Core";
  outPath: string;
}): Promise<void> {
  const { subjectPath, backgroundName, outPath } = opts;
  const compositeCfg = cfg.postprocess.composite;
  const [canvasW, canvasH] = compositeCfg.canvas_size;
  // Load subject image
  const subject = sharp(subjectPath).ensureAlpha();
  const subjectMeta = await subject.metadata();
  // Resize subject relative to canvas
  const subjectWidth = Math.floor(canvasW * compositeCfg.subject_scale);
  const subjectBuf = await subject.resize(subjectWidth).toBuffer();

  // Prepare canvas with the desired background
  const bgPath = cfg.postprocess.assets[backgroundName];
  let base: sharp.Sharp;
  try {
    const bgBuf = await fs.readFile(path.resolve(__dirname, "..", bgPath));
    base = sharp(bgBuf).resize(canvasW, canvasH, { fit: "cover" }).ensureAlpha();
  } catch {
    // Fallback: solid colour based on background name
    let color: { r: number; g: number; b: number };
    if (backgroundName === "Builder Grid") color = { r: 0, g: 60, b: 150 };
    else if (backgroundName === "Dual Core") color = { r: 0, g: 30, b: 80 };
    else color = { r: 50, g: 100, b: 200 };
    base = sharp({
      create: {
        width: canvasW,
        height: canvasH,
        channels: 4,
        background: { ...color, alpha: 1 }
      }
    });
  }

  // Begin composing layers
  let img = base;

  // Shadow behind subject
  if (compositeCfg.subject_shadow && compositeCfg.subject_shadow.enabled) {
    const shadowOpacity = compositeCfg.subject_shadow.opacity;
    const blurRadius = compositeCfg.subject_shadow.blur;
    const offsetY = compositeCfg.subject_shadow.offsetY;
    // Create a blurred black rectangle to simulate drop shadow
    const subjMeta = subjectMeta;
    const shadowWidth = subjectWidth;
    const shadowHeight = Math.floor((subjMeta.height || subjectWidth) * (subjectWidth / (subjMeta.width || subjectWidth)));
    const shadowBuffer = await sharp({
      create: {
        width: shadowWidth,
        height: shadowHeight,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: shadowOpacity }
      }
    }).blur(blurRadius).toBuffer();
    img = img.composite([
      {
        input: shadowBuffer,
        gravity: "center",
        top: offsetY
      }
    ]);
  }
  // Subject itself on top of shadow
  img = img.composite([
    {
      input: subjectBuf,
      gravity: "center",
      blend: "over"
    }
  ]);

  // Add logo
  const logoCfg = cfg.postprocess.logo;
  try {
    const logoBuf = await fs.readFile(path.resolve(__dirname, "..", logoCfg.path));
    const logo = sharp(logoBuf).ensureAlpha();
    const logoMeta = await logo.metadata();
    const targetWidth = Math.floor(canvasW * logoCfg.scale);
    const logoResized = await logo.resize(targetWidth).toBuffer();
    const resizedMeta = await sharp(logoResized).metadata();
    let left = canvasW - (resizedMeta.width || targetWidth) - logoCfg.padding;
    let top = logoCfg.padding;
    if (logoCfg.anchor === "top-left") {
      left = logoCfg.padding;
      top = logoCfg.padding;
    } else if (logoCfg.anchor === "bottom-right") {
      left = canvasW - (resizedMeta.width || targetWidth) - logoCfg.padding;
      top = canvasH - (resizedMeta.height || targetWidth) - logoCfg.padding;
    } else if (logoCfg.anchor === "bottom-left") {
      left = logoCfg.padding;
      top = canvasH - (resizedMeta.height || targetWidth) - logoCfg.padding;
    }
    img = img.composite([
      {
        input: logoResized,
        left: left,
        top: top,
        blend: "over",
        opacity: logoCfg.opacity
      }
    ]);
  } catch {
    // Silently ignore missing logo
  }
  // Write final PNG
  await img.png({ compressionLevel: 9 }).toFile(outPath);
}