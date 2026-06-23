/**
 * @openapi
 * /api/hr/dashboard:
 *   get:
 *     tags: [HR]
 *     summary: HR dashboard data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard metrics and recent activity
 *
 * /api/hr/analytics:
 *   get:
 *     tags: [HR]
 *     summary: HR analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics data
 *
 * /api/hr/employees:
 *   get:
 *     tags: [HR]
 *     summary: List employees
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Employee list
 *   post:
 *     tags: [HR]
 *     summary: Create employee
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Employee created
 *
 * /api/hr/profile:
 *   get:
 *     tags: [HR]
 *     summary: Get HR profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: HR profile
 *   put:
 *     tags: [HR]
 *     summary: Update HR profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile updated
 *
 * /api/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Admin dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin dashboard data
 *
 * /api/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List all users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User list
 *
 * /api/admin/jobs:
 *   get:
 *     tags: [Admin]
 *     summary: List all jobs (admin view)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Job list
 *
 * /api/admin/jobs/pending:
 *   get:
 *     tags: [Admin]
 *     summary: List pending job approvals
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending jobs
 *
 * /api/admin/analytics:
 *   get:
 *     tags: [Admin]
 *     summary: Admin analytics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics overview
 */
