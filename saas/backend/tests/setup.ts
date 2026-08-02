import { config } from 'dotenv';
import path from 'node:path';

// Point every test at the dedicated saas_test database, never saas_dev.
config({ path: path.resolve(__dirname, '../.env.test'), override: true });
