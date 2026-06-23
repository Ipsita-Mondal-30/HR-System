/**
 * @openapi
 * /api/candidate/profile:
 *   get:
 *     tags: [Candidate]
 *     summary: Get candidate profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Candidate profile
 *   put:
 *     tags: [Candidate]
 *     summary: Update candidate profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *
 * /api/candidate/dashboard-stats:
 *   get:
 *     tags: [Candidate]
 *     summary: Get candidate dashboard stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *
 * /api/candidate/apply:
 *   post:
 *     tags: [Candidate]
 *     summary: Apply to a job
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted
 *
 * /api/candidate/applications:
 *   get:
 *     tags: [Candidate]
 *     summary: List candidate applications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Applications list
 *
 * /api/candidate/saved-jobs:
 *   get:
 *     tags: [Candidate]
 *     summary: List saved jobs
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved jobs
 *
 * /api/candidate/save-job:
 *   post:
 *     tags: [Candidate]
 *     summary: Save a job
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               jobId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Job saved
 *
 * /api/candidate/interviews:
 *   get:
 *     tags: [Candidate]
 *     summary: List candidate interviews
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Scheduled interviews
 */
