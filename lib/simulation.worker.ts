// Bundled by webpack as a Web Worker via new Worker(new URL(..., import.meta.url)).
// Runs in a separate thread — pure computation, no DOM access.
import { runSimulation } from './simulation';
import type { SimParams, SimSummary } from './simulation';

interface Req  { params: SimParams; paths: number; id: number }
interface Resp { result: SimSummary; id: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(self as any).onmessage = ({ data }: MessageEvent<Req>) => {
  const result = runSimulation(data.params, data.paths);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).postMessage({ result, id: data.id } as Resp);
};
