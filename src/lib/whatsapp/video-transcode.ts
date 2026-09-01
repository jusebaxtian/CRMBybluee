import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

const TARGET_MAX_BYTES = 16 * 1024 * 1024; // WhatsApp's hard video size limit
const SAFETY_MARGIN = 0.9; // headroom for container overhead + bitrate variance
const AUDIO_BITRATE_KBPS = 96;
const MIN_VIDEO_BITRATE_KBPS = 150;
const MAX_VIDEO_BITRATE_KBPS = 3000;
const MAX_DIMENSION = 1280;

async function probeVideo(filePath: string): Promise<{ duration: number; width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height:format=duration",
    "-of",
    "json",
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const stream = data.streams?.[0] ?? {};
  const duration = parseFloat(data.format?.duration);
  return {
    duration: Number.isFinite(duration) && duration > 0 ? duration : 60,
    width: Number(stream.width) || 1280,
    height: Number(stream.height) || 720,
  };
}

function evenize(n: number): number {
  const rounded = Math.round(n);
  return rounded % 2 === 0 ? rounded : rounded - 1;
}

// WhatsApp's Cloud API only accepts H.264 video + AAC audio inside an MP4
// container, AND rejects anything over 16MB. Phones (especially iPhone)
// commonly default to HEVC/H.265, which uploads and even "sends"
// successfully but Meta rejects during its own processing step with a
// codec error — disconnected from the moment the file was picked.
//
// Re-encoding to H.264/AAC guarantees codec compatibility. Targeting the
// bitrate from the source's actual duration (rather than a fixed quality
// level like a constant CRF) is what guarantees the *size* stays under
// 16MB regardless of how long or high-resolution the source is — a fixed
// CRF produces wildly different file sizes depending on length/resolution.
//
// The bitrate math is only a prediction, not a guarantee: ffprobe's
// duration can be off for some containers (.mov / variable frame rate is
// the common case), and libx264's single-pass ABR can still overshoot its
// -b:v target on high-motion content even with maxrate/bufsize set. A
// client hit exactly this — the "computed" bitrate produced a 39MB file
// for a 16MB target. So after encoding, the actual output size is
// checked and re-encoded at a proportionally lower bitrate (up to 2 extra
// tries) until it's actually under the limit, instead of trusting the
// pre-encode estimate.
export async function transcodeVideoToH264(buffer: Buffer, sourceExt: string): Promise<Buffer> {
  const id = crypto.randomUUID();
  const inPath = path.join(tmpdir(), `${id}-in.${sourceExt || "mp4"}`);
  const outPath = path.join(tmpdir(), `${id}-out.mp4`);
  await writeFile(inPath, buffer);
  try {
    const { duration, width, height } = await probeVideo(inPath);

    const targetBits = TARGET_MAX_BYTES * SAFETY_MARGIN * 8;
    let videoBitrateKbps = Math.min(
      MAX_VIDEO_BITRATE_KBPS,
      Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(targetBits / duration / 1000) - AUDIO_BITRATE_KBPS)
    );

    // A low bitrate budget on a full-resolution source looks worse than the
    // same budget on a downscaled one — cap the larger dimension once the
    // bitrate gets tight. libx264 requires even width/height.
    const largerDim = Math.max(width, height);
    const scale = largerDim > MAX_DIMENSION ? MAX_DIMENSION / largerDim : 1;
    const outWidth = evenize(width * scale);
    const outHeight = evenize(height * scale);

    const MAX_ATTEMPTS = 3;
    let result: Buffer | null = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await execFileAsync(
        "ffmpeg",
        [
          "-y",
          "-i",
          inPath,
          "-c:v",
          "libx264",
          "-profile:v",
          "main",
          "-pix_fmt",
          "yuv420p",
          "-preset",
          "veryfast",
          "-b:v",
          `${videoBitrateKbps}k`,
          "-maxrate",
          `${Math.round(videoBitrateKbps * 1.5)}k`,
          "-bufsize",
          `${videoBitrateKbps * 2}k`,
          "-vf",
          `scale=${outWidth}:${outHeight}`,
          "-c:a",
          "aac",
          "-b:a",
          `${AUDIO_BITRATE_KBPS}k`,
          // Moves the moov atom to the front so WhatsApp/players can start
          // reading the file before it's fully downloaded.
          "-movflags",
          "+faststart",
          outPath,
        ],
        { maxBuffer: 1024 * 1024 * 50 }
      );

      const out = await readFile(outPath);
      if (out.length <= TARGET_MAX_BYTES || attempt === MAX_ATTEMPTS) {
        result = out;
        break;
      }

      // Overshot — scale the bitrate down proportionally to how far over we
      // landed (with headroom) and re-encode instead of returning something
      // Meta will reject.
      const overshootRatio = out.length / (TARGET_MAX_BYTES * SAFETY_MARGIN);
      videoBitrateKbps = Math.max(MIN_VIDEO_BITRATE_KBPS, Math.floor(videoBitrateKbps / overshootRatio));
    }

    return result as Buffer;
  } finally {
    await unlink(inPath).catch(() => {});
    await unlink(outPath).catch(() => {});
  }
}
