import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { unlink, writeFile, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const WHISPER_EXTS = [
  'flac',
  'm4a',
  'mp3',
  'mp4',
  'mpeg',
  'mpga',
  'oga',
  'ogg',
  'wav',
  'webm',
] as const;

export function looksLikeAudio(file: Buffer): boolean {
  if (file.length < 12) {
    return false;
  }

  const head = file.subarray(0, 16).toString('utf8');
  if (head.startsWith('<') || head.startsWith('{') || head.startsWith('[')) {
    return false;
  }

  return true;
}

export function whisperFileName(fileName: string, link: string, file: Buffer): string {
  const haystack = `${fileName} ${link}`.toLowerCase();
  for (const ext of WHISPER_EXTS) {
    if (haystack.includes(`.${ext}`)) {
      return `audio.${ext}`;
    }
  }

  if (file[0] === 0x4f && file[1] === 0x67 && file[2] === 0x67) {
    return 'audio.ogg';
  }
  if (file[0] === 0x52 && file[1] === 0x49 && file[2] === 0x46) {
    return 'audio.wav';
  }
  if (file[0] === 0x49 && file[1] === 0x44 && file[2] === 0x33) {
    return 'audio.mp3';
  }

  // WhatsApp / Kommo casi siempre es Opus; Whisper a veces solo acepta .ogg.
  return 'audio.ogg';
}

export async function prepareWhisperUpload(file: Buffer, fileName: string, link: string) {
  const converted = await convertToWav(file);
  if (converted) {
    return { file: converted, fileName: 'audio.wav' };
  }

  return { file, fileName: whisperFileName(fileName, link, file) };
}

async function convertToWav(file: Buffer): Promise<Buffer | null> {
  const id = randomBytes(8).toString('hex');
  const inputPath = join(tmpdir(), `kommo-in-${id}.ogg`);
  const outputPath = join(tmpdir(), `kommo-out-${id}.wav`);

  try {
    await writeFile(inputPath, file);
    await runFfmpeg(inputPath, outputPath);
    return await readFile(outputPath);
  } catch {
    return null;
  } finally {
    await unlink(inputPath).catch(() => undefined);
    await unlink(outputPath).catch(() => undefined);
  }
}

function runFfmpeg(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-ar', '16000', '-ac', '1', outputPath],
      { stdio: 'ignore' },
    );

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('ffmpeg timeout'));
    }, 20_000);

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exit ${code}`));
    });
  });
}
