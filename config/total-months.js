const curriculumFiles = require('./curriculum-files.json');

// Single source of truth for how many content "months" exist, derived from
// the curriculum file catalog itself so it never drifts out of sync as
// months are added (currently 1-12 plus Bonus Month = 13).
const TOTAL_MONTHS = Object.values(curriculumFiles).reduce((max, entry) => {
  return typeof entry === 'object' && entry.month > max ? entry.month : max;
}, 0);

module.exports = { TOTAL_MONTHS };
