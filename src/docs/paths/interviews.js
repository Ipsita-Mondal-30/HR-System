/**
 * @openapi
 * /api/interviews:
 *   get:
 *     tags: [Interviews]
 *     summary: List interviews (HR/Admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Interview list
 *   post:
 *     tags: [Interviews]
 *     summary: Schedule an interview
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               applicationId:
 *                 type: string
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *               type:
 *                 type: string
 *     responses:
 *       201:
 *         description: Interview scheduled
 *
 * /api/interviews/{id}:
 *   get:
 *     tags: [Interviews]
 *     summary: Get interview by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interview details
 *   delete:
 *     tags: [Interviews]
 *     summary: Delete an interview
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Interview deleted
 *
 * /api/interviews/{id}/status:
 *   put:
 *     tags: [Interviews]
 *     summary: Update interview status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated
 *
 * /api/interview-prep/applied-jobs:
 *   get:
 *     tags: [Interview Prep]
 *     summary: Get jobs candidate applied to
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Applied jobs for prep
 *
 * /api/interview-prep/questions/{jobId}:
 *   get:
 *     tags: [Interview Prep]
 *     summary: Generate practice questions for a job
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Generated questions
 *
 * /api/video-interview-prep/start-session:
 *   post:
 *     tags: [Video Interview]
 *     summary: Start a video interview prep session
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Session started
 *
 * /api/voice-interview/start:
 *   post:
 *     tags: [Voice Interview]
 *     summary: Start a voice interview session
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
 *         description: Session started
 *
 * /api/voice-interview/history:
 *   get:
 *     tags: [Voice Interview]
 *     summary: Get voice interview history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Past sessions
 */
