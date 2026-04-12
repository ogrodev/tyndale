/** Simple line reader from stdin. Prompts with the given message and returns the trimmed input. */
export function readLine(prompt?: string): Promise<string> {
  if (prompt) {
    process.stdout.write(prompt);
  }
  return new Promise((resolve) => {
    let data = '';
    const onData = (chunk: Buffer) => {
      data += chunk.toString();
      if (data.includes('\n')) {
        process.stdin.removeListener('data', onData);
        process.stdin.pause();
        resolve(data.split('\n')[0]);
      }
    };
    process.stdin.resume();
    process.stdin.on('data', onData);
  });
}
