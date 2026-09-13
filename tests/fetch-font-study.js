// 下载 AITI 对比页专用字形与各字体原始许可；不修改小程序字体。
const fs = require('node:fs');
const path = require('node:path');
const dir = path.resolve(__dirname, '../docs/font-study');
const families = [
  ['Bungee', 'bungee'], ['Archivo Black', 'archivoblack'],
  ['Unbounded', 'unbounded'], ['Outfit', 'outfit'], ['Fredoka', 'fredoka']
];
async function fetchChecked(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response;
}
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const css = await (await fetchChecked('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bungee&family=Fredoka:wght@600&family=Outfit:wght@900&family=Unbounded:wght@800&text=AITI&display=swap')).text();
  const results = await Promise.allSettled(families.map(async ([family, slug]) => {
    const block = css.split('@font-face').find(value => value.includes(`font-family: '${family}'`));
    if (!block) throw new Error(`Missing ${family}`);
    const url = block.match(/url\(([^)]+)\)/)[1];
    const [fontResponse, licenseResponse] = await Promise.all([
      fetchChecked(url), fetchChecked(`https://raw.githubusercontent.com/google/fonts/main/ofl/${slug}/OFL.txt`)
    ]);
    const bytes = Buffer.from(await fontResponse.arrayBuffer());
    if (bytes.readUInt32BE(0) !== 0x00010000) throw new Error(`Unexpected TTF format: ${family}`);
    const license = await licenseResponse.text();
    if (!license.includes('SIL OPEN FONT LICENSE')) throw new Error(`Unexpected license: ${family}`);
    fs.writeFileSync(path.join(dir, `${slug}.ttf`), bytes);
    fs.writeFileSync(path.join(dir, `${slug}-OFL.txt`), license);
    console.log(`${family}: ${bytes.length} bytes, OFL saved`);
  }));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
  fs.writeFileSync(path.join(dir, 'google-fonts-source.css'), css);
})().catch(error => { console.error(error); process.exitCode = 1; });
