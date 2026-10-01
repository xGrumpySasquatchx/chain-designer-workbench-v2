const PAGE_LINES = 46;
const LINE_WIDTH = 88;

function ascii(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function escapePdf(text: string): string {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(text: string, width: number): string[] {
  const clean = ascii(text);
  if (clean.length <= width) return [clean];
  const out: string[] = [];
  let rest = clean;
  while (rest.length > width) {
    let cut = rest.lastIndexOf(' ', width);
    if (cut < 24) cut = width;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  out.push(rest);
  return out;
}

/** A text-only PDF. Each input line is wrapped onto letter pages. */
export function textPdf(lines: string[]): Uint8Array {
  const wrapped = lines.flatMap((line) => wrapLine(line, LINE_WIDTH));
  const chunks: string[][] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += PAGE_LINES) {
    chunks.push(wrapped.slice(i, i + PAGE_LINES));
  }

  const objects: string[] = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'];
  const kids: number[] = [];
  let next = 4;
  for (const chunk of chunks) {
    const pageId = next++;
    const contentId = next++;
    kids.push(pageId);
    const commands = [
      'BT',
      '/F1 10 Tf',
      '54 742 Td',
      '14 TL',
      ...chunk.map((line) => `(${escapePdf(line)}) Tj T*`),
      'ET',
    ].join('\n');
    objects[pageId - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
    objects[contentId - 1] = `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`;
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${kids.map((id) => `${id} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) body += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

export function downloadPdf(filename: string, bytes: Uint8Array) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
