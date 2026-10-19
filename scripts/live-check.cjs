const { Engine, validateUrl, userError } = require('../app/engine.cjs');
const path = require('node:path');
const fs = require('node:fs/promises');
const engine = new Engine({ bin: path.join(__dirname, '../bin'), runtime: process.execPath });
const output = path.join(__dirname, '../test-output/live');
(async () => {
  const job = { id: 'live-check', ...validateUrl('https://www.youtube.com/watch?v=YE7VzlLtp-4'), options: { mode: 'both', format: 'mp4', quality: '360' } };
  const report = {};
  try {
    Object.assign(job, await engine.inspect(job));
    report.metadata = { title: job.title, duration: job.duration, heights: job.heights };
    console.log('Metadata:', report.metadata);
    const result = await engine.download(job, output);
    report.download = result;
    console.log('Download:', result);
  } catch (error) { report.error = error.message; report.userMessage = userError(error.message); console.log('Live check:', report.userMessage, error.message); process.exitCode = 1; }
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
})();
