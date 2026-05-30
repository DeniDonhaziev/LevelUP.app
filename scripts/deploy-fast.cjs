/** Только загрузка dist/ на expo.app — без пересборки (быстрее). */
process.env.SKIP_EXPORT = '1';
require('./deploy-expo-prod.cjs');
