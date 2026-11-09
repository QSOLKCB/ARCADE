/* SPDX-License-Identifier: Apache-2.0 */
// ARCADE 3 hall configuration for the shared ARCADE 2 shell (../arcade2/app.js).
(function (A) {
  'use strict';
  A.HALL = {prefix: 'qsol-arcade3:', name: 'ARCADE 3', title: 'ARCADE 3 — The Graveyard Shift', featured: 'knockout',
    winTitles: {knockout: 'CHAMPION OF THE CIRCUIT!', feud: 'RIVALRY SETTLED.'}, previewTicks: {knockout: 170, feud: 160},
    previewRunners: ['commando', 'lantern', 'sleepwalker'],
    categories: {action: ['commando', 'lantern', 'sleepwalker'], sport: ['feud', 'knockout']}, otherCategory: 'shooter'};
})(globalThis.Arcade2);
