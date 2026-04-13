import { availableParallelism, cpus } from 'os';

export function suggestConcurrency(): number {
  const cores = typeof availableParallelism === 'function'
    ? availableParallelism()
    : cpus().length;
  return Math.min(Math.max(cores, 4), 16);
}

export function resolveConcurrency(configured?: number): { value: number; source: 'config' | 'auto' } {
  if (configured !== undefined && configured > 0) {
    return { value: configured, source: 'config' };
  }
  return { value: suggestConcurrency(), source: 'auto' };
}
