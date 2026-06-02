import 'dotenv/config';
import { reheatAll } from '../src/services/heatScore.js';

reheatAll()
  .then(n => {
    console.log(`[Reheat] Done: ${n} articles rescored`);
    process.exit(0);
  })
  .catch(err => {
    console.error('[Reheat] Error:', err);
    process.exit(1);
  });
