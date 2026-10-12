import fs from 'node:fs';

// Docker secrets stay out of images, source control and process arguments.
export function secret(name, fallback = '') {
  const file = process.env[`${name}_FILE`];
  return file ? fs.readFileSync(file, 'utf8').trim() : process.env[name] || fallback;
}
