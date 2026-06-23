/**
 * @openapi
 * /api/applications:
 *   get:
 *     tags: [Applications]
 *     summary: List applications
 *     responses:
 *       200:
 *         description: List of applications
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Application'
 *   post:
 *     tags: [Applications]
 *     summary: Submit an application
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *               jobId:
 *                 type: string
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Application submitted
 *
 * /api/applications/my:
 *   get:
 *     tags: [Applications]
 *     summary: Get my applications (candidate)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Candidate's applications
 *
 * /api/applications/job/{jobId}:
 *   get:
 *     tags: [Applications]
 *     summary: Get applications for a job
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Applications for the job
 *
 * /api/applications/{id}:
 *   get:
 *     tags: [Applications]
 *     summary: Get application by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application details
 *   put:
 *     tags: [Applications]
 *     summary: Update application status
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
 * /api/application-drafts:
 *   get:
 *     tags: [Application Drafts]
 *     summary: List my application drafts
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved drafts
 *   post:
 *     tags: [Application Drafts]
 *     summary: Save application draft
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *               jobId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Draft saved
 *
 * /api/application-drafts/job/{jobId}:
 *   get:
 *     tags: [Application Drafts]
 *     summary: Get draft for a specific job
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
 *         description: Draft for job
 *
 * /api/application-drafts/{draftId}:
 *   delete:
 *     tags: [Application Drafts]
 *     summary: Delete a draft
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: draftId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Draft deleted
 */
