import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const walk = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory() ? walk(p + '/' + x.name) : [p + '/' + x.name],
  );
const paths = [
  'lib/s1',
  'app/api/s1',
  'app/s1',
  'app/s1-before-emr',
  'public/s1',
]
  .flatMap(walk)
  .filter((x) => !x.endsWith('/manifest.json'))
  .sort();
const files = Object.fromEntries(
  paths.map((p) => [
    p,
    createHash('sha256').update(readFileSync(p)).digest('hex'),
  ]),
);
writeFileSync(
  'lib/s1/manifest.json',
  JSON.stringify(
    {
      digest: createHash('sha256').update(JSON.stringify(files)).digest('hex'),
      files,
    },
    null,
    2,
  ) + '\n',
);
console.log('S1 BE 원본·화면·양식 ' + paths.length + '개 지문 갱신');
