import { runMigrations } from './migrate';

runMigrations().then(
  () => {
    console.log('Migrations complete');
  },
  (error) => {
    console.error(error);
    process.exit(1);
  }
);
