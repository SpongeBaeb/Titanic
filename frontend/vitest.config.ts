import { defineConfig } from 'vitest/config';
import path from 'node:path';

// 순수 로직(확률, 분기, 성향 점수)만 시험한다. 화면은 시험하지 않는다.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
